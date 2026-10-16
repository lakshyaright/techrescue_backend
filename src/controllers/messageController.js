const db = require('../config/db');

// @desc    Get messages for a query
// @route   GET /api/v1/messages/:queryId
exports.getMessages = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT m.*, u.name as sender_name, u.role as sender_role 
       FROM chat_messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.query_id = $1 
       ORDER BY m.created_at ASC`,
      [req.params.queryId]
    );
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

// @desc    Post a new chat message
// @route   POST /api/v1/messages/:queryId
exports.sendMessage = async (req, res, next) => {
  try {
    const { message, attachmentName } = req.body;
    const msgId = `msg-${Date.now()}`;

    const insertText = `
      INSERT INTO chat_messages (id, query_id, sender_id, message, attachment_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(insertText, [
      msgId,
      req.params.queryId,
      req.user.id,
      message,
      attachmentName || null
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};
