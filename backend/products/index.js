const AWS = require('aws-sdk');
const rds = new AWS.RDSDataService();
const s3 = new AWS.S3();

// Database connection parameters
const dbParams = {
  secretArn: process.env.DB_SECRET_ARN,
  resourceArn: process.env.DB_RESOURCE_ARN,
  database: 'salepointdb'
};

exports.handler = async (event) => {
  try {
    const path = event.path;
    const method = event.httpMethod;
    const queryParams = event.queryStringParameters || {};
    
    // GET /products - List all products
    if (path === '/products' && method === 'GET') {
      const sql = 'SELECT * FROM products';
      const result = await executeQuery(sql);
      
      // Add image URLs from S3 for each product
      const productsWithImages = await Promise.all(result.records.map(async (product) => {
        const productId = product[0].stringValue; // Assuming productId is the first field
        const imageKey = `products/${productId}/main.jpg`;
        
        try {
          const imageUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.PRODUCT_BUCKET,
            Key: imageKey,
            Expires: 3600
          });
          
          return {
            ...mapRecordToProduct(product),
            imageUrl
          };
        } catch (error) {
          console.error(`Error getting image for product ${productId}:`, error);
          return mapRecordToProduct(product);
        }
      }));
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(productsWithImages)
      };
    }
    
    // GET /products/{id} - Get product details
    if (path.match(/^\/products\/[\w-]+$/) && method === 'GET') {
      const productId = path.split('/').pop();
      const sql = 'SELECT * FROM products WHERE product_id = :productId';
      const result = await executeQuery(sql, [
        { name: 'productId', value: { stringValue: productId } }
      ]);
      
      if (result.records.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Product not found' })
        };
      }
      
      const product = mapRecordToProduct(result.records[0]);
      
      // Get product image and documents
      try {
        const imageKey = `products/${productId}/main.jpg`;
        product.imageUrl = s3.getSignedUrl('getObject', {
          Bucket: process.env.PRODUCT_BUCKET,
          Key: imageKey,
          Expires: 3600
        });
        
        const specKey = `products/${productId}/specs.pdf`;
        product.specUrl = s3.getSignedUrl('getObject', {
          Bucket: process.env.PRODUCT_BUCKET,
          Key: specKey,
          Expires: 3600
        });
      } catch (error) {
        console.error(`Error getting product assets for ${productId}:`, error);
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(product)
      };
    }
    
    // Search products
    if (path === '/products/search' && method === 'GET') {
      const searchTerm = queryParams.q || '';
      if (!searchTerm) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Search term is required' })
        };
      }
      
      const sql = 'SELECT * FROM products WHERE name LIKE :searchTerm OR description LIKE :searchTerm';
      const result = await executeQuery(sql, [
        { name: 'searchTerm', value: { stringValue: `%${searchTerm}%` } }
      ]);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(result.records.map(mapRecordToProduct))
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

async function executeQuery(sql, parameters = []) {
  const params = {
    ...dbParams,
    sql,
    parameters
  };
  
  return await rds.executeStatement(params).promise();
}

function mapRecordToProduct(record) {
  // Map RDS Data API records to product object
  // This would depend on your exact schema
  return {
    id: record[0].stringValue,
    name: record[1].stringValue,
    description: record[2].stringValue,
    price: parseFloat(record[3].doubleValue),
    stock: parseInt(record[4].longValue),
    category: record[5].stringValue,
    // Add other fields as needed
  };
}
