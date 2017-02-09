"use strict";

const assert = require('chai').assert;
const QiwiShop = require('../index');
const express = require('express');
const request = require('supertest');
const bodyParser = require('body-parser');

QiwiShop.request = function(options) {
  return Promise.resolve(options)
};

let lastCreateRefundHash = QiwiShop.prototype._createRefundHash;

QiwiShop.prototype._createRefundHash = function() {
  return this._lastCreatedRefund = lastCreateRefundHash.apply(this, arguments);
};

describe('WalletOne:', function () {
  let projectId = '1';
  let apiId = '2';
  let apiPassword = '3';
  let notifyPassword = '4';
  let qiwi;
  let apiUrlStart = `https://api.qiwi.com/api/v2/prv/${projectId}/bills/`;

  describe('#constructor()', function () {
    try {
      new QiwiShop(projectId);
      assert.isOk(false);
    }
    catch(e) {}

    try {
      new QiwiShop(projectId, apiId);
      assert.isOk(false);
    }
    catch(e) {}

    try {
      new QiwiShop(projectId, apiId, apiPassword);
      assert.isOk(false);
    }
    catch(e) {}

    qiwi = new QiwiShop(projectId, apiId, apiPassword, notifyPassword);
  });

  let data = {
    user: 'tel:+79999999999',
    amount: '10'
  };

  let lastBillId;

  function checkOptions(urlRegex, method, options) {
    assert.equal(JSON.stringify(options.auth), JSON.stringify({
      user: apiId, pass: apiPassword
    }), 'wrong basic auth headers');

    assert.equal(JSON.stringify(options.headers), JSON.stringify({
      accept: 'text/json', 'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    }), 'wrong basic auth headers');

    assert.equal(options.method, method, 'wrong method');
    assert.isOk(options.url.match(urlRegex), 'wrong url');
    assert.isOk(options.json, 'wrong json');
  }

  describe('methods', function () {
    it('#createBill(), #beforeCreateBill()', function() {
      let calledBefore;

      qiwi.beforeCreateBill = function(billId, data) {
        assert.isString(billId);
        assert.isObject(data);
        lastBillId = billId;
        calledBefore = true;

        return Promise.resolve();
      };

      return qiwi.createBill(data).then(function(options) {
        checkOptions(apiUrlStart + lastBillId, 'PUT', options);

        assert.isOk(calledBefore);
        assert.isDefined(options.form.user, 'wrong user');
        assert.isDefined(options.form.amount, 'wrong amount');
        assert.isString(options.form.ccy, 'wrong ccy');
        assert.isString(options.form.comment, 'wrong comment');
        assert.isString(options.form.prv_name, 'wrong prv_name');
        assert.isString(options.form.pay_source, 'wrong pay_source');
        assert.isString(options.form.lifetime, 'wrong lifetime');
      });
    });

    it('#getBillStatus()', function() {
      return qiwi.getBillStatus(lastBillId).then(function(options) {
        checkOptions(apiUrlStart + lastBillId, 'GET', options);
      });
    });

    it('#cancelBill()', function() {
      return qiwi.cancelBill(lastBillId).then(function(options) {
        checkOptions(apiUrlStart + lastBillId, 'PATCH', options);
      });
    });

    it('#refundBill()', function() {
      return qiwi.refundBill(lastBillId, '10').then(function(options) {
        checkOptions(apiUrlStart + lastBillId + '/refund/' + qiwi._lastCreatedRefund, 'PUT', options);
      });
    });

    it('#getRefundStatus()', function() {
      return qiwi.getRefundStatus(lastBillId, qiwi._lastCreatedRefund).then(function(options) {
        checkOptions(apiUrlStart + lastBillId + '/refund/' + qiwi._lastCreatedRefund, 'GET', options);
      });
    });

    it('#getPaymentUrl()', function() {
      assert.equal(qiwi.getPaymentUrl({test: 'test'}), 'https://qiwi.com/order/external/main.action?test=test');
    });
  });

  describe('notification', function () {
    it('check basic authentication error', function (done) {
      let app = express();
      let error;

      data = {
        test: true
      };

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify(() => {}, (err, meta) => {
        (meta.type != 'basic') && (error = new Error('basic authentication error checking was failed'));
      }));

      request(app)
        .post('/notify')
        .send(data)
        .expect(() => {
          if(error) {
            throw error;
          }
        })
        .end(done)
    });

    it('check signature authentication error', function (done) {
      let app = express();
      let error;

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify(() => {}, (err, meta) => {
        (meta.type != 'signature') && (error = new Error('signature authentication error checking was failed'));
      }, true));

      request(app)
        .post('/notify')
        .send(data)
        .expect(() => {
          if(error) {
            throw error;
          }
        })
        .end(done)
    });


    it('check basic authentication success', function (done) {
      let app = express();

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify((body, callback) => {
        assert.equal(JSON.stringify(body), JSON.stringify(data));
        callback();
      }));

      request(app)
        .post('/notify')
        .auth(projectId, notifyPassword)
        .send(data)
        .expect((res) => {
          if(res.text != '<?xml version="1.0" encoding="UTF-8"?><result><result_code>0</result_code></result>') {
            throw new Error('wrong response body')
          }
        })
        .end(done)
    });

    it('check signature authentication success', function (done) {
      let app = express();

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify(() => {
        return Promise.resolve();
      }, true));


      request(app)
        .post('/notify')
        .set('X-Api-Signature', 'VD7vhBRfy0N9I1nmJ3Y7Bv7ZzLE=')
        .send(data)
        .expect(200)
        .end(done)
    });

    it('check success request with callback error', function (done) {
      let app = express();

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify((body, callback) => {
        callback(new Error('success'));
      }));

      request(app)
        .post('/notify')
        .auth(projectId, notifyPassword)
        .send(data)
        .expect('<?xml version="1.0" encoding="UTF-8"?><result><result_code>300</result_code></result>')
        .end(done)
    });

    it('check success request with promise error', function (done) {
      let app = express();

      app.use(bodyParser.json());

      app.post('/notify', qiwi.notify(() => {
        return Promise.reject(new Error('success'));
      }));

      request(app)
        .post('/notify')
        .auth(projectId, notifyPassword)
        .send(data)
        .expect('<?xml version="1.0" encoding="UTF-8"?><result><result_code>300</result_code></result>')
        .end(done)
    });
  });
});

