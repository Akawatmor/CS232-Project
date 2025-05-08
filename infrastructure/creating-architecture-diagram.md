# Creating the SalePoint Architecture Diagram

To create the architecture diagram for the SalePoint solution, follow these steps:

## Option 1: Using AWS Architecture Icons

1. Download official AWS Architecture Icons from: https://aws.amazon.com/architecture/icons/

2. Use a drawing tool like Microsoft PowerPoint, Visio, Draw.io, or Lucidchart

3. Create the diagram following the structure shown in the `diagram.txt` file

4. Export the diagram as PNG at 1200x900 resolution

5. Save the file to: `infrastructure/images/architecture-diagram.png`

## Option 2: Using AWS Application Composer

1. Log in to the AWS Console

2. Navigate to AWS Application Composer

3. Create a new application

4. Drag and drop the following services onto the canvas:
   - Amazon CloudFront
   - Amazon S3 (2 instances - one for static assets, one for product files)
   - Amazon API Gateway
   - AWS Lambda (5 functions)
   - Amazon RDS
   - Amazon DynamoDB
   - Amazon Cognito
   - Amazon QuickSight
   - CloudWatch

5. Connect the services according to the data flow described in the architecture document

6. Export the diagram as PNG

7. Save the file to: `infrastructure/images/architecture-diagram.png`

## Option 3: Using an Online Diagram Tool

1. Visit draw.io (https://app.diagrams.net/)

2. Start a new diagram

3. Select AWS from the icon library

4. Create the diagram following the structure shown in the `diagram.txt` file

5. Export the diagram as PNG

6. Save the file to: `infrastructure/images/architecture-diagram.png`

## Required Elements in the Diagram

Ensure the diagram includes:

1. All AWS services mentioned in the architecture document
2. Proper connections showing data flow
3. Clear visual grouping of related services
4. A legend explaining any symbols or color coding used
5. Client applications (web browsers, mobile devices)

The final image should be clear enough to read when printed on a letter-sized paper.
