const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

// AWS Configuration
const config = {
  region: 'us-east-1', // Change to your preferred region
  s3BucketName: 'salepoint-webapp', // Change to your bucket name
  cloudFrontDistributionId: '', // Optional: If using CloudFront
  profile: 'default' // AWS credentials profile to use
};

// Configure AWS SDK
if (config.profile) {
  const credentials = new AWS.SharedIniFileCredentials({ profile: config.profile });
  AWS.config.credentials = credentials;
}

AWS.config.update({ region: config.region });

const s3 = new AWS.S3();
const cloudfront = new AWS.CloudFront();

// Function to upload a file to S3
const uploadFile = async (filePath, bucketName) => {
  const fileContent = fs.readFileSync(filePath);
  const relativeFilePath = path.relative('frontend', filePath).replace(/\\/g, '/');
  
  const params = {
    Bucket: bucketName,
    Key: relativeFilePath,
    Body: fileContent,
    ContentType: mime.lookup(filePath) || 'application/octet-stream'
  };

  try {
    const data = await s3.upload(params).promise();
    console.log(`Uploaded: ${relativeFilePath}`);
    return data;
  } catch (err) {
    console.error(`Error uploading ${relativeFilePath}: ${err.message}`);
    throw err;
  }
};

// Function to recursively upload a directory
const uploadDirectory = async (directoryPath, bucketName) => {
  const files = fs.readdirSync(directoryPath);
  
  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      await uploadDirectory(filePath, bucketName);
    } else {
      await uploadFile(filePath, bucketName);
    }
  }
};

// Function to create S3 bucket if it doesn't exist
const createBucketIfNotExists = async (bucketName) => {
  try {
    await s3.headBucket({ Bucket: bucketName }).promise();
    console.log(`Bucket ${bucketName} already exists`);
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`Creating bucket: ${bucketName}`);
      await s3.createBucket({ Bucket: bucketName }).promise();
      
      // Configure the bucket for static website hosting
      await s3.putBucketWebsite({
        Bucket: bucketName,
        WebsiteConfiguration: {
          IndexDocument: {
            Suffix: 'index.html'
          },
          ErrorDocument: {
            Key: 'index.html'
          }
        }
      }).promise();
      
      // Set bucket policy to allow public access
      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [{
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`
        }]
      };
      
      await s3.putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy)
      }).promise();
      
      console.log(`Bucket ${bucketName} created and configured for website hosting`);
    } else {
      throw err;
    }
  }
};

// Function to invalidate CloudFront cache (if using CloudFront)
const invalidateCloudFrontCache = async (distributionId) => {
  if (!distributionId) return;
  
  const params = {
    DistributionId: distributionId,
    InvalidationBatch: {
      CallerReference: Date.now().toString(),
      Paths: {
        Quantity: 1,
        Items: ['/*']
      }
    }
  };
  
  try {
    await cloudfront.createInvalidation(params).promise();
    console.log('CloudFront cache invalidation initiated');
  } catch (err) {
    console.error(`Error invalidating CloudFront cache: ${err.message}`);
    throw err;
  }
};

// Function to create or update IAM policy for QuickSight access
const setupQuickSightPolicy = async () => {
  const iam = new AWS.IAM();
  const policyName = `${config.s3BucketName}-quicksight-policy`;
  
  const policyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Action: [
          'quicksight:GenerateEmbedUrlForRegisteredUser',
          'quicksight:GetDashboardEmbedUrl',
          'quicksight:GetSessionEmbedUrl'
        ],
        Resource: [
          `arn:aws:quicksight:${config.region}:${AWS.config.credentials.accountId}:dashboard/*`,
          `arn:aws:quicksight:${config.region}:${AWS.config.credentials.accountId}:user/*`
        ]
      }
    ]
  };
  
  try {
    // Check if policy exists
    try {
      await iam.getPolicy({ PolicyArn: `arn:aws:iam::${AWS.config.credentials.accountId}:policy/${policyName}` }).promise();
      console.log(`Policy ${policyName} already exists. Updating...`);
      
      // Get the policy version
      const policyData = await iam.getPolicy({ PolicyArn: `arn:aws:iam::${AWS.config.credentials.accountId}:policy/${policyName}` }).promise();
      const defaultVersionId = policyData.Policy.DefaultVersionId;
      
      // Create a new version and set as default
      await iam.createPolicyVersion({
        PolicyArn: `arn:aws:iam::${AWS.config.credentials.accountId}:policy/${policyName}`,
        PolicyDocument: JSON.stringify(policyDocument),
        SetAsDefault: true
      }).promise();
      
      // Delete the old version (maximum of 5 versions allowed)
      if (defaultVersionId !== 'v1') {
        await iam.deletePolicyVersion({
          PolicyArn: `arn:aws:iam::${AWS.config.credentials.accountId}:policy/${policyName}`,
          VersionId: defaultVersionId
        }).promise();
      }
      
    } catch (err) {
      if (err.code === 'NoSuchEntity') {
        // Create new policy
        await iam.createPolicy({
          PolicyName: policyName,
          PolicyDocument: JSON.stringify(policyDocument)
        }).promise();
        console.log(`Created new IAM policy: ${policyName}`);
      } else {
        throw err;
      }
    }
    
    console.log('QuickSight policy setup complete');
  } catch (err) {
    console.error('Error setting up QuickSight policy:', err);
    throw err;
  }
};

// Main deploy function
const deploy = async () => {
  try {
    console.log('Starting deployment to AWS...');
    
    // Create S3 bucket if it doesn't exist
    await createBucketIfNotExists(config.s3BucketName);
    
    // Setup IAM policy for QuickSight (add this line)
    await setupQuickSightPolicy();
    
    // Upload frontend files
    console.log('Uploading files to S3...');
    await uploadDirectory('frontend', config.s3BucketName);
    
    // Invalidate CloudFront cache if using CloudFront
    if (config.cloudFrontDistributionId) {
      await invalidateCloudFrontCache(config.cloudFrontDistributionId);
    }
    
    console.log('Deployment completed successfully!');
    console.log(`Website URL: http://${config.s3BucketName}.s3-website-${config.region}.amazonaws.com/`);
  } catch (err) {
    console.error('Deployment failed:', err);
    process.exit(1);
  }
};

// Run the deployment
deploy();
