const db = require('../config/db');

// @desc    Get all queries / tickets
// @route   GET /api/v1/queries
exports.getQueries = async (req, res, next) => {
  try {
    const { status, priority, category } = req.query;
    let queryText = 'SELECT * FROM queries WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      queryText += ` AND status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      queryText += ` AND priority = $${params.length}`;
    }

    if (category) {
      params.push(category);
      queryText += ` AND category = $${params.length}`;
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, params);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single query by ID
// @route   GET /api/v1/queries/:id
exports.getQuery = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM queries WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Query ticket not found' });
    }

    const ticket = result.rows[0];

    // Fetch associated work logs
    const logs = await db.query('SELECT * FROM work_logs WHERE query_id = $1 ORDER BY created_at DESC', [ticket.id]);
    ticket.workLogs = logs.rows;

    res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new query ticket
// @route   POST /api/v1/queries
exports.createQuery = async (req, res, next) => {
  try {
    const {
      title,
      category,
      subcategory,
      impact,
      urgency,
      shortDescription,
      detailedDescription,
      environment,
      assignmentGroup,
      estimatedCost
    } = req.body;

    // Compute priority
    let priority = 'MEDIUM';
    if (impact === 'ENTERPRISE' || urgency === 'EMERGENCY') priority = 'CRITICAL';
    else if (impact === 'HIGH' || urgency === 'HIGH') priority = 'HIGH';

    // Compute SLA target
    const slaHours = priority === 'CRITICAL' ? 2 : priority === 'HIGH' ? 4 : 12;
    const slaDeadline = new Date(Date.now() + slaHours * 3600000);

    const ticketId = `tkt-${Date.now()}`;
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ticketNumber = `INC-${datePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;

    const insertText = `
      INSERT INTO queries (
        id, ticket_number, title, category, subcategory, impact, urgency, priority, status,
        client_id, short_description, detailed_description, environment, assignment_group,
        estimated_cost, is_escrow_funded, sla_deadline
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 'OPEN',
        $9, $10, $11, $12, $13,
        $14, true, $15
      ) RETURNING *
    `;

    const result = await db.query(insertText, [
      ticketId,
      ticketNumber,
      title,
      category,
      subcategory || '',
      impact,
      urgency,
      priority,
      req.user.id,
      shortDescription,
      detailedDescription,
      environment,
      assignmentGroup,
      estimatedCost || 3500.00,
      slaDeadline
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

// @desc    Accept / Claim Ticket using POSTGRESQL TRANSACTION LOCK
// @route   POST /api/v1/queries/:id/accept
// @access  EXPERT
exports.acceptJobWithLock = async (req, res, next) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock row with SELECT ... FOR UPDATE
    const selectQuery = 'SELECT id, ticket_number, status, assigned_expert_id FROM queries WHERE id = $1 FOR UPDATE';
    const checkResult = await client.query(selectQuery, [req.params.id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    const ticket = checkResult.rows[0];

    // 2. Concurrency check: If already claimed or not OPEN
    if (ticket.status !== 'OPEN') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `Lock Collision: Ticket ${ticket.ticket_number} is already claimed by another specialist (Status: ${ticket.status}).`
      });
    }

    // 3. Atomically update status and assign expert
    const updateQuery = `
      UPDATE queries 
      SET status = 'IN_PROGRESS', assigned_expert_id = $1, updated_at = NOW() 
      WHERE id = $2 
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [req.user.id, req.params.id]);

    // 4. Record audit log
    await client.query(
      `INSERT INTO activity_logs (id, query_id, ticket_number, user_id, user_name, user_role, action, details, activity_type)
       VALUES ($1, $2, $3, $4, $5, 'EXPERT', 'Job Accepted & Locked', 'Atomic lock secured. Status updated to IN_PROGRESS.', 'assignment')`,
      [`act-${Date.now()}`, ticket.id, ticket.ticket_number, req.user.id, req.user.name]
    );

    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: `Successfully secured atomic lock on ${ticket.ticket_number}`,
      data: updateResult.rows[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

// @desc    Update ticket status progression
// @route   PATCH /api/v1/queries/:id/status
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const result = await db.query(
      'UPDATE queries SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
