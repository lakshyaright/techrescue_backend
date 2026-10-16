const db = require('../config/db');

// @desc    Get all available experts
// @route   GET /api/v1/experts
exports.getExperts = async (req, res, next) => {
  try {
    const { skill, available } = req.query;
    let queryText = "SELECT id, name, email, company, location, title, bio, rating, reviews_count, hourly_rate, experience_years, verified, is_available FROM users WHERE role = 'EXPERT'";
    const params = [];

    if (available === 'true') {
      queryText += ' AND is_available = true';
    }

    queryText += ' ORDER BY rating DESC';

    const result = await db.query(queryText, params);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};
