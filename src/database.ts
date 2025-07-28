import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a new pool instance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Connected to Neon PostgreSQL database');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

// Initialize database tables
export const initDatabase = async () => {
  const client = await pool.connect();
  
  try {
    // Create tables if they don't exist
    await client.query(`
      -- Testers table
      CREATE TABLE IF NOT EXISTS testers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Submissions table
      CREATE TABLE IF NOT EXISTS submissions (
        id SERIAL PRIMARY KEY,
        tester_id INTEGER REFERENCES testers(id),
        submission_date DATE NOT NULL,
        overall_rating INTEGER CHECK (overall_rating >= 0 AND overall_rating <= 100),
        final_suggestions TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Test sections table
      CREATE TABLE IF NOT EXISTS test_sections (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id),
        section_name VARCHAR(50) NOT NULL,
        uiux_rating INTEGER CHECK (uiux_rating >= 0 AND uiux_rating <= 100),
        comments TEXT
      );

      -- Feature tests table
      CREATE TABLE IF NOT EXISTS feature_tests (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES test_sections(id),
        feature_name VARCHAR(255) NOT NULL,
        test_status VARCHAR(20) NOT NULL CHECK (test_status IN ('Pass', 'Fail', 'Not Tested'))
      );

      -- Bug reports table
      CREATE TABLE IF NOT EXISTS bug_reports (
        id SERIAL PRIMARY KEY,
        submission_id INTEGER REFERENCES submissions(id),
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('Critical', 'High', 'Medium', 'Low')),
        description TEXT NOT NULL,
        screenshot_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Screenshots table
      CREATE TABLE IF NOT EXISTS screenshots (
        id SERIAL PRIMARY KEY,
        section_id INTEGER REFERENCES test_sections(id),
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(500) NOT NULL,
        file_size INTEGER,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_submissions_tester_id ON submissions(tester_id);
      CREATE INDEX IF NOT EXISTS idx_test_sections_submission_id ON test_sections(submission_id);
      CREATE INDEX IF NOT EXISTS idx_feature_tests_section_id ON feature_tests(section_id);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_submission_id ON bug_reports(submission_id);
      CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
      CREATE INDEX IF NOT EXISTS idx_screenshots_section_id ON screenshots(section_id);
    `);
    
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

export default pool;