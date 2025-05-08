/**
 * Dashboard routes for QuickSight embedding
 */
const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const auth = require('../middleware/auth');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

/**
 * GET /api/dashboard/embed-url
 * Returns an embedding URL for QuickSight dashboard
 */
router.get('/embed-url', auth, async (req, res) => {
  try {
    // QuickSight dashboard configuration
    const dashboardId = process.env.QUICKSIGHT_DASHBOARD_ID;
    const awsAccountId = process.env.AWS_ACCOUNT_ID;
    const quicksightNamespace = process.env.QUICKSIGHT_NAMESPACE || 'default';
    const userArn = `arn:aws:quicksight:${process.env.AWS_REGION}:${awsAccountId}:user/${quicksightNamespace}/${req.user.email}`;
    
    // Get the QuickSight client
    const quicksight = new AWS.QuickSight({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    // Set up parameters for dashboard embedding
    const params = {
      AwsAccountId: awsAccountId,
      DashboardId: dashboardId,
      IdentityType: 'QUICKSIGHT', // Use QuickSight or IAM identity
      SessionLifetimeInMinutes: 600, // 10 hours
      UserArn: userArn,
      // Add additional dashboard permissions as needed
      AdditionalDashboardIds: [] // If you want to embed multiple dashboards
    };
    
    // Generate the embedding URL
    quicksight.generateEmbedUrlForRegisteredUser(params, (err, data) => {
      if (err) {
        console.error('Error generating QuickSight embed URL:', err);
        return res.status(500).json({ 
          error: 'Failed to generate dashboard URL',
          details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
      }
      
      // Return the embedding URL and other relevant data
      res.json({
        embedUrl: data.EmbedUrl,
        expiresAt: data.ExpiresAt,
        requestId: data.RequestId,
        status: data.Status
      });
    });
  } catch (error) {
    console.error('Error in /api/dashboard/embed-url:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
