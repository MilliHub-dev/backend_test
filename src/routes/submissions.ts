import express from 'express';
import pool from '../database';

const router = express.Router();

// Save a new submission
router.post('/', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const formData = req.body;
    
    // Insert tester
    const testerResult = await client.query(
      'INSERT INTO testers (name, role) VALUES ($1, $2) RETURNING id',
      [formData.testerInfo.name, formData.testerInfo.role]
    );
    const testerId = testerResult.rows[0].id;
    
    // Insert submission
    const submissionResult = await client.query(
      'INSERT INTO submissions (tester_id, submission_date, overall_rating, final_suggestions) VALUES ($1, $2, $3, $4) RETURNING id',
      [
        testerId,
        formData.testerInfo.date,
        formData.finalFeedback.overallRating,
        formData.finalFeedback.suggestions
      ]
    );
    const submissionId = submissionResult.rows[0].id;
    
    // Insert test sections
    const sections = ['passengerApp', 'driverApp', 'crossApp'];
    const sectionNames = ['passenger_app', 'driver_app', 'cross_app'];
    
    for (let i = 0; i < sections.length; i++) {
      const section = formData[sections[i]];
      if (section) {
        const sectionResult = await client.query(
          'INSERT INTO test_sections (submission_id, section_name, uiux_rating, comments) VALUES ($1, $2, $3, $4) RETURNING id',
          [
            submissionId,
            sectionNames[i],
            section.uiuxRating?.rating || 50,
            section.comments || ''
          ]
        );
        const sectionId = sectionResult.rows[0].id;
        
        // Insert feature tests
        if (section.features) {
          for (const [featureName, featureData] of Object.entries(section.features)) {
            await client.query(
              'INSERT INTO feature_tests (section_id, feature_name, test_status) VALUES ($1, $2, $3)',
              [sectionId, featureName, (featureData as any).status]
            );
          }
        }
      }
    }
    
    // Insert bug reports
    if (formData.bugReports && formData.bugReports.length > 0) {
      for (const bug of formData.bugReports) {
        await client.query(
          'INSERT INTO bug_reports (submission_id, priority, description, screenshot_url) VALUES ($1, $2, $3, $4)',
          [submissionId, bug.priority, bug.description, bug.screenshot || null]
        );
      }
    }
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Submission saved successfully',
      submissionId 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save submission' 
    });
  } finally {
    client.release();
  }
});

// Get all submissions
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        s.id,
        s.submission_date,
        s.overall_rating,
        s.final_suggestions,
        s.created_at,
        t.name as tester_name,
        t.role as tester_role,
        json_agg(
          json_build_object(
            'section_name', ts.section_name,
            'uiux_rating', ts.uiux_rating,
            'comments', ts.comments,
            'features', (
              SELECT json_agg(
                json_build_object(
                  'feature_name', ft.feature_name,
                  'test_status', ft.test_status
                )
              )
              FROM feature_tests ft 
              WHERE ft.section_id = ts.id
            )
          )
        ) as sections,
        (
          SELECT json_agg(
            json_build_object(
              'priority', br.priority,
              'description', br.description,
              'screenshot_url', br.screenshot_url,
              'created_at', br.created_at
            )
          )
          FROM bug_reports br 
          WHERE br.submission_id = s.id
        ) as bug_reports
      FROM submissions s
      JOIN testers t ON s.tester_id = t.id
      LEFT JOIN test_sections ts ON s.id = ts.submission_id
      GROUP BY s.id, t.name, t.role
      ORDER BY s.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // Transform the data to match the frontend format
    const transformedData = result.rows.map(row => ({
      id: row.id,
      testerInfo: {
        name: row.tester_name,
        role: row.tester_role,
        date: row.submission_date
      },
      finalFeedback: {
        overallRating: row.overall_rating,
        suggestions: row.final_suggestions
      },
      sections: row.sections,
      bugReports: row.bug_reports || [],
      submittedAt: row.created_at
    }));
    
    res.json(transformedData);
    
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch submissions' 
    });
  }
});

// Delete a submission
router.delete('/:id', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const submissionId = req.params.id;
    
    // Delete in reverse order of foreign key dependencies
    await client.query('DELETE FROM feature_tests WHERE section_id IN (SELECT id FROM test_sections WHERE submission_id = $1)', [submissionId]);
    await client.query('DELETE FROM screenshots WHERE section_id IN (SELECT id FROM test_sections WHERE submission_id = $1)', [submissionId]);
    await client.query('DELETE FROM test_sections WHERE submission_id = $1', [submissionId]);
    await client.query('DELETE FROM bug_reports WHERE submission_id = $1', [submissionId]);
    await client.query('DELETE FROM submissions WHERE id = $1', [submissionId]);
    
    await client.query('COMMIT');
    
    res.json({ 
      success: true, 
      message: 'Submission deleted successfully' 
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting submission:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete submission' 
    });
  } finally {
    client.release();
  }
});

export default router;