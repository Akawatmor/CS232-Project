# SalePoint Architecture

## Overview

SalePoint is a comprehensive sales management solution built on AWS Cloud services. It allows sales staff to access accurate, up-to-date product information through a web application by integrating data from various departments like inventory, marketing, and sales.

## AWS Services Architecture

![SalePoint Architecture Diagram](./images/architecture-diagram.png)

### Core Services

1. **Amazon RDS (MySQL)**: 
   - Stores structured data including products, inventory, users, and sales transactions
   - Provides ACID compliance for critical business transactions
   - Enables complex queries across relational data

2. **Amazon DynamoDB**:
   - Stores customer-salesperson relationships and status tracking
   - Provides fast access to customer records by salesperson
   - Offers flexible schema for customer interaction history

3. **Amazon S3**:
   - Stores product images, PDF specifications, and marketing materials
   - Provides cost-effective object storage with high durability
   - Delivers content through Amazon CloudFront for fast global access

4. **AWS Lambda**:
   - Powers serverless backend logic
   - Processes API requests and database operations
   - Handles business logic for inventory updates, sales processing, etc.

5. **Amazon API Gateway**:
   - Provides RESTful API interface to backend services
   - Handles authentication, rate limiting, and request/response transformations
   - Creates a unified entry point for all client applications

6. **Amazon QuickSight**:
   - Generates business intelligence dashboards
   - Provides sales analytics and performance metrics
   - Offers interactive data visualization for decision-makers

### Additional Services

7. **Amazon Cognito**:
   - Manages user authentication and authorization
   - Provides secure access control to the application
   - Integrates with existing identity providers

8. **Amazon CloudFront**:
   - Serves web application and static assets globally
   - Reduces latency for end users
   - Provides edge caching for frequently accessed content

9. **AWS CloudWatch**:
   - Monitors application performance
   - Tracks API usage and error rates
   - Provides logging and alerting capabilities

10. **AWS CloudFormation**:
    - Defines infrastructure as code
    - Enables consistent environment deployment
    - Facilitates infrastructure management and versioning

## Data Flow

1. **Authentication Flow**:
   - Users authenticate via Amazon Cognito
   - Temporary credentials are issued for API access
   - Role-based access control restricts data access

2. **Product Information Flow**:
   - Product data is stored in RDS MySQL
   - Product images and documents are stored in S3
   - Lambda functions retrieve and combine data for API responses

3. **Sales Transaction Flow**:
   - Sales are initiated through the web application
   - API Gateway routes request to Lambda functions
   - Lambda performs transaction processing in RDS
   - Stock levels are updated in real-time
   - Customer data is updated in DynamoDB

4. **Reporting Flow**:
   - Transaction data is stored in RDS
   - QuickSight connects to RDS for real-time analytics
   - Sales managers access dashboards for performance monitoring
