const AWS = require('aws-sdk');
const rds = new AWS.RDSDataService();
const dynamodb = new AWS.DynamoDB.DocumentClient();

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
    
    // POST /sales - Create a new sale transaction
    if (path === '/sales' && method === 'POST') {
      const sale = JSON.parse(event.body);
      
      // Validate required fields
      if (!sale.customerId || !sale.salesRepId || !sale.items || sale.items.length === 0) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Customer ID, Sales Rep ID, and items are required' })
        };
      }
      
      // Start a transaction
      const transactionId = await startTransaction();
      
      try {
        // Create sale record with UUID
        const saleId = `sale_${Date.now()}`;
        
        // Calculate amounts
        const subTotal = sale.items.reduce((total, item) => total + (item.price * item.quantity), 0);
        const discountAmount = sale.discountAmount || 0;
        const taxAmount = sale.taxAmount || (subTotal * 0.07); // Default 7% tax if not specified
        const totalAmount = subTotal - discountAmount + taxAmount;
        
        const createSaleSql = `
          INSERT INTO sales (
            sale_id, customer_id, sales_rep_id, sale_date, 
            total_amount, discount_amount, tax_amount, 
            status, payment_method, notes
          )
          VALUES (
            :saleId, :customerId, :salesRepId, NOW(), 
            :totalAmount, :discountAmount, :taxAmount, 
            :status, :paymentMethod, :notes
          )
        `;
        
        await executeQuery(createSaleSql, [
          { name: 'saleId', value: { stringValue: saleId } },
          { name: 'customerId', value: { stringValue: sale.customerId } },
          { name: 'salesRepId', value: { stringValue: sale.salesRepId } },
          { name: 'totalAmount', value: { doubleValue: totalAmount } },
          { name: 'discountAmount', value: { doubleValue: discountAmount } },
          { name: 'taxAmount', value: { doubleValue: taxAmount } },
          { name: 'status', value: { stringValue: 'PENDING' } },
          { name: 'paymentMethod', value: { stringValue: sale.paymentMethod || 'CASH' } },
          { name: 'notes', value: { stringValue: sale.notes || '' } }
        ], transactionId);
        
        // Create sale items
        for (const item of sale.items) {
          const createItemSql = `
            INSERT INTO sale_items (sale_id, product_id, quantity, price)
            VALUES (:saleId, :productId, :quantity, :price)
          `;
          
          await executeQuery(createItemSql, [
            { name: 'saleId', value: { stringValue: saleId } },
            { name: 'productId', value: { stringValue: item.productId } },
            { name: 'quantity', value: { longValue: item.quantity } },
            { name: 'price', value: { doubleValue: item.price } }
          ], transactionId);
          
          // Update product stock
          const updateStockSql = `
            UPDATE products
            SET stock = stock - :quantity
            WHERE product_id = :productId AND stock >= :quantity
          `;
          
          const updateResult = await executeQuery(updateStockSql, [
            { name: 'quantity', value: { longValue: item.quantity } },
            { name: 'productId', value: { stringValue: item.productId } }
          ], transactionId);
          
          if (updateResult.numberOfRecordsUpdated === 0) {
            throw new Error(`Insufficient stock for product ${item.productId}`);
          }
        }
        
        // Update customer record in DynamoDB with latest sale info
        await dynamodb.update({
          TableName: 'SalePoint-Customers',
          Key: {
            CustomerId: sale.customerId
          },
          UpdateExpression: 'set LastPurchaseDate = :lastPurchaseDate, LastPurchaseAmount = :lastPurchaseAmount, LastSaleId = :lastSaleId',
          ExpressionAttributeValues: {
            ':lastPurchaseDate': new Date().toISOString(),
            ':lastPurchaseAmount': totalAmount,
            ':lastSaleId': saleId
          }
        }).promise();
        
        // Commit the transaction
        await commitTransaction(transactionId);
        
        return {
          statusCode: 201,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            saleId,
            message: 'Sale created successfully',
            totalAmount
          })
        };
      } catch (error) {
        // Rollback the transaction if there's an error
        await rollbackTransaction(transactionId);
        throw error;
      }
    }
    
    // GET /sales - List all sales
    if (path === '/sales' && method === 'GET') {
      const sql = `
        SELECT s.sale_id, s.customer_id, s.sales_rep_id, s.sale_date, s.total_amount, s.status, 
               c.name as customer_name
        FROM sales s
        JOIN customers c ON s.customer_id = c.customer_id
        ORDER BY s.sale_date DESC
      `;
      
      const result = await executeQuery(sql);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(mapSalesRecords(result.records))
      };
    }
    
    // GET /sales/{id} - Get sale details
    if (path.match(/^\/sales\/[\w-]+$/) && method === 'GET') {
      const saleId = path.split('/').pop();
      
      // Get sale header
      const saleSql = `
        SELECT s.sale_id, s.customer_id, s.sales_rep_id, s.sale_date, s.total_amount, s.status,
               c.name as customer_name, c.email as customer_email,
               u.name as sales_rep_name
        FROM sales s
        JOIN customers c ON s.customer_id = c.customer_id
        JOIN users u ON s.sales_rep_id = u.user_id
        WHERE s.sale_id = :saleId
      `;
      
      const saleResult = await executeQuery(saleSql, [
        { name: 'saleId', value: { stringValue: saleId } }
      ]);
      
      if (saleResult.records.length === 0) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Sale not found' })
        };
      }
      
      // Get sale items
      const itemsSql = `
        SELECT si.product_id, si.quantity, si.price,
               p.name as product_name, p.description
        FROM sale_items si
        JOIN products p ON si.product_id = p.product_id
        WHERE si.sale_id = :saleId
      `;
      
      const itemsResult = await executeQuery(itemsSql, [
        { name: 'saleId', value: { stringValue: saleId } }
      ]);
      
      const sale = mapSaleRecord(saleResult.records[0]);
      sale.items = mapSaleItemsRecords(itemsResult.records);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(sale)
      };
    }
    
    // PUT /sales/{id}/status - Update sale status
    if (path.match(/^\/sales\/[\w-]+\/status$/) && method === 'PUT') {
      const saleId = path.split('/')[2];
      const { status } = JSON.parse(event.body);
      
      if (!status || !['PENDING', 'COMPLETED', 'CANCELLED'].includes(status)) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Valid status is required (PENDING, COMPLETED, CANCELLED)' })
        };
      }
      
      const sql = `
        UPDATE sales
        SET status = :status
        WHERE sale_id = :saleId
      `;
      
      const result = await executeQuery(sql, [
        { name: 'status', value: { stringValue: status } },
        { name: 'saleId', value: { stringValue: saleId } }
      ]);
      
      if (result.numberOfRecordsUpdated === 0) {
        return {
          statusCode: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ message: 'Sale not found' })
        };
      }
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ message: `Sale status updated to ${status}` })
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
      body: JSON.stringify({ message: 'Internal server error', error: error.message })
    };
  }
};

async function startTransaction() {
  const params = {
    ...dbParams
  };
  
  const result = await rds.beginTransaction(params).promise();
  return result.transactionId;
}

async function commitTransaction(transactionId) {
  const params = {
    ...dbParams,
    transactionId
  };
  
  return await rds.commitTransaction(params).promise();
}

async function rollbackTransaction(transactionId) {
  const params = {
    ...dbParams,
    transactionId
  };
  
  return await rds.rollbackTransaction(params).promise();
}

async function executeQuery(sql, parameters = [], transactionId = null) {
  const params = {
    ...dbParams,
    sql,
    parameters
  };
  
  if (transactionId) {
    params.transactionId = transactionId;
  }
  
  return await rds.executeStatement(params).promise();
}

function mapSalesRecords(records) {
  return records.map(mapSaleRecord);
}

function mapSaleRecord(record) {
  // Map RDS Data API record to sale object
  return {
    id: record[0].stringValue,
    customerId: record[1].stringValue,
    salesRepId: record[2].stringValue,
    date: record[3].stringValue,
    totalAmount: parseFloat(record[4].doubleValue),
    status: record[5].stringValue,
    customerName: record[6].stringValue
  };
}

function mapSaleItemsRecords(records) {
  return records.map(record => ({
    productId: record[0].stringValue,
    quantity: parseInt(record[1].longValue),
    price: parseFloat(record[2].doubleValue),
    productName: record[3].stringValue,
    productDescription: record[4].stringValue
  }));
}
