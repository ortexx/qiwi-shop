# Install  
`npm install qiwi-shop`

# About  
Qiwi shop rest api module (qiwi.com)

# Example  
```js
const QiwiShop = require("qiwi-shop");
const express = require("express");
const app = express();

let projectId = "0000001"; // shop id
let apiId = "0000000001"; // api id
let apiPassword = "apiapiapi"; // api password
let notifyPassword = "notifynotifynotify"; // notify password

const qiwi = new QiwiShop(projectId, apiId, apiPassword, notifyPassword);

// Create new bill

// this action is optional
qiwi.beforeCreateBill = function(billId, data) {
    // you can save information to db before request e.t.c.
    // must return promise
}

// creation request
app.post('/payments/bill/create/', (req, res, next) => {    
    qiwi.createBill({
        user: 'tel:+7910100100',
        amount: '10',
        ccy: 'RUB', // optional
        comment: 'recharge', // optional
        lifetime: new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5).toISOString(), // optional
        pay_source: 'qw', // optional
        prv_name: 'example.com' // optional
    }).then((result) => {
        if(!result || !result.response || result.response.result_code != 0) {
            throw new Error('Qiwi bill creation fail');
        }
        
        // redirect to payment (optional)
        res.redirect(`${qiwi.getPaymentUrl()}?shop=${qiwi.projectId}&transaction=${result.response.bill.bill_id}&other_options=...`);
    });
});

// notify handler 
let successHandler = (data, callback) => {
    // data === req.body    
    // save payment info in db e.t.c    
    // callback() or return promise
};

let errorHandler = (err, meta) => {
    // you can save to a file, db e.t.c.
    // operation must be synchronous or in the background 
};

let authenticationBySignature = false; // false == basic authentication

app.post('payments/notify/handler/', qiwi.notify(successHandler, errorHandler, authenticationBySignature));

```

# Description  
You can write custom notify handler, but library version includes data/authentication validation and automatically send all headers in the necessary format

# API  
### .constructor(projectId, apiId, apiPassword, notifyPassword)  
all arguments you can find in your qiwi shop account  

### .getPaymentUrl([query])  
returns qiwi bill creation url

### .beforeCreateBill(billId, data)  
called before bill creation request, but after bill hash creation

### .createBill(data)  
returns promise, create bill, data options must comply with documentation  
.user and .amount is required

### .getBillStatus(billId)  
returns promise, get bill status

### .cancelBill(billId)  
returns promise, cancel bill

### .refundBill(billId, data)  
returns promise, refund bill,  data options must comply with documentation

### .getRefundStatus(billId, refundId)  
returns promise, get bill refund status

### .checkNotifyAuthBasic(req)  
check notify basic authentication

### .checkNotifyAuthSignature(req)  
check notify by signature

### .createXml(code)  
create xml string for response

### .notify(fn, onError, [checkSignature])  
qiwi notify handler, it is "connect" middleware



