# Install  
`npm install qiwi-shop`  

# About  
Qiwi shop rest api module (qiwi.com)  

# Example  
## Dependencies

```js
const QiwiShop = require("qiwi-shop");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();

app.use(bodyParser.json());
```

## Creation of bills

```js
const projectId = "0000001"; // shop id
const apiId = "0000000001"; // api id
const apiPassword = "api"; // api password
const notifyPassword = "notify"; // notify password

const inFiveDays = new Date().getTime() + 1000 * 60 * 60 * 24 * 5;
const qiwi = new QiwiShop(projectId, apiId, apiPassword, notifyPassword);

// this action is optional
qiwi.beforeCreateBill = function(billId, data) {
    // you can save an information to db before request e.t.c.
    // you may return promise
}

app.post('/payments/bill/create/', (req, res, next) => {    
    qiwi.createBill({
        user: 'tel:+7910100100',
        amount: '10',
        ccy: 'RUB', 
        comment: 'recharge',
        lifetime: new Date(inFiveDays).toISOString(),
        pay_source: 'qw',
        prv_name: 'example.com' 
    }).then((result) => {
        if(!result || !result.response || result.response.result_code != 0) {
            throw new Error('Qiwi bill creation fail');
        }
        
        // redirect to payment (optional)
        res.redirect(qiwi.getPaymentUrl({ shop: qiwi.projectId, transaction: result.response.bill.bill_id }));
    });
});
```

## Handling a notification

```js
// notification handler 
const successHandler = (data, callback) => {
    // data === req.body    
    // save payment info or something else in a db e.t.c    
    // callback() or return promise
};

const errorHandler = (err, meta) => {
    // you can save something to a file, db e.t.c.
    // the operation must be synchronous or in the background 
};

let authenticationBySignature = false; // false == basic authentication

app.post('payments/notification/', qiwi.notify(successHandler, errorHandler, authenticationBySignature));

```

# Description  
You can write custom notification handler, but library version includes data/authentication validation and automatically send all headers in the necessary format

# API  
### .constructor(projectId, apiId, apiPassword, notifyPassword)  
you can find all arguments in your qiwi shop account  

### .getPaymentUrl([query])  
returns qiwi bill creation url

### .beforeCreateBill(billId, data)  
will be called before a bill creation request, but after a hash creation

### .createBill(data)  
returns promise, create a bill, data options must comply with documentation  
.user and .amount is required

### .getBillStatus(billId)  
returns promise, get a bill status

### .cancelBill(billId)  
returns promise, cancel a bill

### .refundBill(billId, data)  
returns promise, refunds a bill,  data options must comply with documentation

### .getRefundStatus(billId, refundId)  
returns promise, gets a bill refund status

### .checkNotifyAuthBasic(req)  
checks a notification by basic authentication

### .checkNotifyAuthSignature(req)  
checks a notification by signature

### .createXml(code)  
creates xml string for response

### .notify(fn, onError, [checkSignature])  
qiwi notification handler, it is "connect" middleware



