const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS SDK
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

const rds = new AWS.RDSDataService();
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB();
const ssm = new AWS.SSM();

async function setupDatabase() {
  try {
    console.log('Starting SalePoint database setup...');
    
    // Get database credentials from SSM Parameter Store
    const dbSecretArn = await getParameter('/salepoint/db/secret-arn');
    const dbResourceArn = await getParameter('/salepoint/db/resource-arn');
    
    // Read SQL schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    // Split SQL statements (crude but effective for most SQL files)
    const sqlStatements = schemaSql
      .split(';')
      .map(statement => statement.trim())
      .filter(statement => statement.length > 0);
    
    console.log(`Found ${sqlStatements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < sqlStatements.length; i++) {
      const sql = sqlStatements[i];
      
      console.log(`Executing statement ${i + 1}/${sqlStatements.length}`);
      
      await rds.executeStatement({
        secretArn: dbSecretArn,
        resourceArn: dbResourceArn,
        database: 'salepointdb',
        sql: sql + ';'
      }).promise();
    }
    
    console.log('RDS database schema created successfully');
    
    // Setup DynamoDB table
    const dynamoSchemaPath = path.join(__dirname, '../../database/dynamodb_schema.json');
    const dynamoSchema = JSON.parse(fs.readFileSync(dynamoSchemaPath, 'utf8'));
    
    // Create DynamoDB table
    for (const tableName of Object.keys(dynamoSchema)) {
      const tableSpec = dynamoSchema[tableName];
      
      try {
        // Check if table exists
        await dynamodb.describeTable({ TableName: tableName }).promise();
        console.log(`Table ${tableName} already exists, skipping creation`);
      } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
          // Create table
          const createParams = {
            TableName: tableSpec.TableName,
            KeySchema: tableSpec.KeySchema,
            AttributeDefinitions: tableSpec.AttributeDefinitions,
            BillingMode: tableSpec.BillingMode
          };
          
          if (tableSpec.GlobalSecondaryIndexes) {
            createParams.GlobalSecondaryIndexes = tableSpec.GlobalSecondaryIndexes;
          }
          
          await dynamodb.createTable(createParams).promise();
          console.log(`Created DynamoDB table: ${tableName}`);
          
          // Wait for table to be active
          console.log(`Waiting for table ${tableName} to become active...`);
          await dynamodb.waitFor('tableExists', { TableName: tableName }).promise();
          console.log(`Table ${tableName} is now active`);
          
          // Insert sample items if provided
          if (tableSpec.SampleItems && tableSpec.SampleItems.length > 0) {
            const documentClient = new AWS.DynamoDB.DocumentClient();
            
            for (const item of tableSpec.SampleItems) {
              await documentClient.put({
                TableName: tableName,
                Item: item
              }).promise();
            }
            
            console.log(`Added ${tableSpec.SampleItems.length} sample items to ${tableName}`);
          }
        } else {
          throw error;
        }
      }
    }
    
    // Create S3 bucket for product assets if it doesn't exist
    const bucketName = `salepoint-product-assets-${AWS.config.credentials.accessKeyId.toLowerCase()}`;
    
    try {
      await s3.headBucket({ Bucket: bucketName }).promise();
      console.log(`S3 bucket ${bucketName} already exists`);
    } catch (error) {
      if (error.code === 'NotFound' || error.code === 'NoSuchBucket') {
        await s3.createBucket({ Bucket: bucketName }).promise();
        console.log(`Created S3 bucket: ${bucketName}`);
        
        // Set bucket CORS configuration
        await s3.putBucketCors({
          Bucket: bucketName,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedHeaders: ['*'],
                AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
                AllowedOrigins: ['*'],
                ExposeHeaders: [],
                MaxAgeSeconds: 3000
              }
            ]
          }
        }).promise();
        
        console.log(`Configured CORS for S3 bucket: ${bucketName}`);
      } else {
        throw error;
      }
    }
    
    console.log('SalePoint database setup completed successfully!');
    
  } catch (error) {
    console.error('Error setting up SalePoint database:', error);
    throw error;
  }
}

async function getParameter(paramName) {
  const result = await ssm.getParameter({
    Name: paramName,
    WithDecryption: true
  }).promise();
  
  return result.Parameter.Value;
}

// Execute if run directly
if (require.main === module) {
  setupDatabase()
    .then(() => console.log('Setup complete'))
    .catch(err => {
      console.error('Setup failed:', err);
      process.exit(1);
    });
}

module.exports = { setupDatabase };
