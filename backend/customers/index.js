const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  try {
    const path = event.path;
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};
    
    // GET /customers - List all customers
    if (path === '/customers' && method === 'GET') {
      const params = {
        TableName: 'SalePoint-Customers'
      };
      
      const result = await dynamodb.scan(params).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.Items)
      };
    }
    
    // GET /customers/{id} - Get customer details
    if (path.match(/^\/customers\/[\w-]+$/) && method === 'GET') {
      const customerId = path.split('/').pop();
      const params = {
        TableName: 'SalePoint-Customers',
        Key: {
          CustomerId: customerId
        }
      };
      
      const result = await dynamodb.get(params).promise();
      
      if (!result.Item) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Customer not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.Item)
      };
    }
    
    // GET /customers/salesrep/{id} - Get customers assigned to a sales rep
    if (path.match(/^\/customers\/salesrep\/[\w-]+$/) && method === 'GET') {
      const salesRepId = path.split('/').pop();
      const params = {
        TableName: 'SalePoint-Customers',
        IndexName: 'SalesRepIndex',
        KeyConditionExpression: 'SalesRepId = :salesRepId',
        ExpressionAttributeValues: {
          ':salesRepId': salesRepId
        }
      };
      
      const result = await dynamodb.query(params).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.Items)
      };
    }
    
    // POST /customers - Create a new customer
    if (path === '/customers' && method === 'POST') {
      const customer = JSON.parse(event.body);
      
      // Validate required fields
      if (!customer.name || !customer.email) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Name and email are required' })
        };
      }
      
      // Generate a unique customer ID if not provided
      if (!customer.CustomerId) {
        customer.CustomerId = `cust_${Date.now()}`;
      }
      
      const params = {
        TableName: 'SalePoint-Customers',
        Item: customer
      };
      
      await dynamodb.put(params).promise();
      
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(customer)
      };
    }
    
    // PUT /customers/{id}/salesrep - Assign a sales rep to a customer
    if (path.match(/^\/customers\/[\w-]+\/salesrep$/) && method === 'PUT') {
      const customerId = path.split('/')[2];
      const { salesRepId } = JSON.parse(event.body);
      
      if (!salesRepId) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Sales rep ID is required' })
        };
      }
      
      const params = {
        TableName: 'SalePoint-Customers',
        Key: {
          CustomerId: customerId
        },
        UpdateExpression: 'set SalesRepId = :salesRepId, LastUpdated = :lastUpdated',
        ExpressionAttributeValues: {
          ':salesRepId': salesRepId,
          ':lastUpdated': new Date().toISOString()
        },
        ReturnValues: 'ALL_NEW'
      };
      
      const result = await dynamodb.update(params).promise();
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.Attributes)
      };
    }
    
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Not found' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
