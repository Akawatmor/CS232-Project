# SalePoint - Sales Transaction Management System

SalePoint is a comprehensive sales management solution built on AWS Cloud services. It allows sales staff to access accurate, up-to-date product information through a web application by integrating data from various departments like inventory, marketing, and sales.

![SalePoint Architecture](./infrastructure/images/architecture-diagram.png)

## Features

- **Product Management**: Track inventory, product details, and specifications
- **Customer Management**: Manage customer information and track sales history
- **Sales Processing**: Create and manage sales transactions
- **Analytics Dashboard**: View sales performance and trends using QuickSight
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI installed and configured
- Node.js and npm installed
- MySQL client (optional, for local development)

## Deployment Instructions

### Option 1: Using CLI

#### Step 1: Configure AWS Credentials

1. Run the configuration script:
   ```bash
   node create-aws-config.js
   ```
2. Enter your AWS Access Key ID, Secret Key, and preferred region when prompted

#### Step 2: Update Environment Variables

1. Create a `.env` file based on the provided example:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your specific AWS details:
   ```
   AWS_REGION=your-region
   AWS_ACCOUNT_ID=your-account-id
   QUICKSIGHT_DASHBOARD_ID=your-dashboard-id
   QUICKSIGHT_NAMESPACE=default
   NODE_ENV=production
   ```

#### Step 3: Deploy Infrastructure

```bash
aws cloudformation deploy --template-file infrastructure/cloudformation-template.yaml --stack-name salepoint-stack --capabilities CAPABILITY_IAM
```

#### Step 4: Set Up Database

```bash
node backend/migrations/setup.js
```

#### Step 5: Deploy Frontend

```bash
npm run deploy
```

### Option 2: Using AWS Console (GUI)

#### Step 1: Set Up AWS Credentials

1. **Create AWS IAM User**:
   - Log in to AWS Console at https://console.aws.amazon.com/
   - Navigate to IAM service and create a user with programmatic access
   - Assign permissions: AmazonS3FullAccess, AmazonRDSFullAccess, AmazonDynamoDBFullAccess, AWSLambdaFullAccess, AmazonAPIGatewayAdministrator, IAMFullAccess, CloudFrontFullAccess, AmazonQuickSightFullAccess
   - Save the Access Key ID and Secret Access Key

2. **Configure Locally**:
   - Run `node create-aws-config.js` and enter your credentials

#### Step 2: Create CloudFormation Stack

1. Navigate to CloudFormation in AWS Console
2. Create a new stack using `infrastructure/cloudformation-template.yaml`
3. Enter stack name and click through to create

#### Step 3: Set Up Database Resources

1. Access your RDS database using the credentials from Secrets Manager
2. Import schema from `database/schema.sql`
3. Create DynamoDB table "SalePoint-Customers" with partition key "CustomerId"
4. Add Global Secondary Index "SalesRepIndex" with partition key "SalesRepId"

#### Step 4: Set Up Lambda Functions

1. Create Lambda functions for Products, Customers, and Sales using the code in the backend directory
2. Configure environment variables for each function
3. Set up appropriate IAM permissions

#### Step 5: Set Up API Gateway

1. Create a new REST API
2. Add resources and methods for /products, /customers, and /sales
3. Integrate with Lambda functions
4. Enable CORS and deploy the API

#### Step 6: Create S3 Bucket for Frontend

1. Create a new S3 bucket
2. Enable static website hosting
3. Configure public read access

#### Step 7: Configure QuickSight

1. Set up QuickSight with appropriate datasets from your RDS database
2. Create and publish a dashboard
3. Configure embedding settings to allow your S3 website URL

#### Step 8: Deploy Frontend Code

1. Update configuration files with your API Gateway URL
2. Upload frontend files to S3 using `npm run deploy`

## Application Structure

SalePoint/ ├── backend/ # Backend Lambda functions │ ├── customers/ # Customer management API │ ├── products/ # Product management API │ ├── sales/ # Sales transaction API │ └── migrations/ # Database setup scripts ├── database/ # Database schemas ├── frontend/ # Web application files │ ├── css/ # Stylesheets │ ├── js/ # JavaScript files │ └── index.html # Main HTML file ├── infrastructure/ # AWS infrastructure files │ └── cloudformation-template.yaml # CloudFormation template ├── .env.example # Example environment variables ├── aws-deploy.js # Deployment script ├── create-aws-config.js # AWS configuration script └── package.json # Project dependencies

## Development

To run the application locally for development:

1. Set up a local MySQL server
2. Import the schema from `database/schema.sql`
3. Update `frontend/js/config.js` with local API endpoints
4. Use a local HTTP server to serve the frontend files

## Troubleshooting

### Common Issues

1. **API Gateway CORS errors**: Ensure CORS is properly enabled in API Gateway for all methods
2. **Database connection issues**: Verify your security groups allow access from Lambda functions
3. **QuickSight embedding errors**: Check that your domain is allowed in QuickSight embedding settings
4. **S3 access denied**: Confirm your bucket policy allows public read access for website hosting

### Getting Help

If you encounter issues during deployment:
1. Check CloudWatch logs for Lambda functions
2. Review the CloudFormation events for stack creation errors
3. Verify all environment variables are correctly set

## Maintenance

### Updates and Patches

1. Make changes to the codebase as needed
2. Run `npm run deploy` to update the frontend
3. Use AWS Console or CLI to update Lambda functions

### Backup

Regular backups are recommended for:
- RDS database (automated snapshots)
- DynamoDB tables (on-demand backups)
- S3 bucket contents (versioning)

## License

Copyright © 2023 SalePoint. All rights reserved.