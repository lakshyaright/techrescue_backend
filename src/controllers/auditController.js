const db = require('../config/db');

// @desc    Get all audit/activity logs
// @route   GET /api/v1/audit-logs
exports.getAuditLogs = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100'
    );
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// @desc    Record new audit log
// @route   POST /api/v1/audit-logs
exports.createAuditLog = async (req, res, next) => {
  try {
    const { queryId, ticketNumber, action, details, activityType } = req.body;
    const logId = `act-${Date.now()}`;
    const result = await db.query(
      `INSERT INTO activity_logs (id, query_id, ticket_number, user_id, user_name, user_role, action, details, activity_type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING *`,
      [
        logId,
        queryId || null,
        ticketNumber || null,
        req.user ? req.user.id : 'usr-system',
        req.user ? req.user.name : 'System Operator',
        req.user ? req.user.role : 'CLIENT',
        action,
        details,
        activityType || 'comment'
      ]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
