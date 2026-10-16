const db = require('../config/db');

// @desc    Get user or platform payments
// @route   GET /api/v1/payments
exports.getPayments = async (req, res, next) => {
  try {
    let queryText = 'SELECT * FROM payments';
    const params = [];

    if (req.user.role === 'CLIENT') {
      params.push(req.user.id);
      queryText += ' WHERE client_id = $1';
    } else if (req.user.role === 'EXPERT' || req.user.role === 'ENGINEER') {
      params.push(req.user.id);
      queryText += ' WHERE payee_id = $1';
    }

    queryText += ' ORDER BY created_at DESC';

    const result = await db.query(queryText, params);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// @desc    Release escrow payout upon client approval
// @route   POST /api/v1/payments/:id/release
exports.releaseEscrow = async (req, res, next) => {
  try {
    const result = await db.query(
      "UPDATE payments SET status = 'RELEASED', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Payment transaction not found' });
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
