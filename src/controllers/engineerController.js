const db = require('../config/db');

// @desc    Get all field engineers
// @route   GET /api/v1/engineers
exports.getEngineers = async (req, res, next) => {
  try {
    const { location } = req.query;
    let queryText = "SELECT id, name, email, location, title, bio, rating, reviews_count, hourly_rate, experience_years, verified, is_available, completed_jobs_count FROM users WHERE role = 'ENGINEER'";
    const params = [];

    if (location) {
      params.push(`%${location}%`);
      queryText += ` AND location ILIKE $${params.length}`;
    }

    queryText += ' ORDER BY completed_jobs_count DESC';

    const result = await db.query(queryText, params);
    res.status(200).json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};
