"use strict";

const request = require('request-promise');
const crypto = require('crypto');
const randomstring = require("randomstring");
const basicAuth = require('basic-auth');
const xml = require('xml');
const qs = require('querystring');

class QiwiShop {
  static request(options) {
    return request(options);
  }

  constructor(projectId, apiId, apiPassword, notificationPassword) {
    this.projectId = projectId;
    this.apiId = apiId;
    this.apiPassword = apiPassword;
    this.notificationPassword = notificationPassword;

    if (!projectId) {
      throw new Error('projectId is missing');
    }

    if (!apiId) {
      throw new Error('apiId is missing');
    }

    if (!apiPassword) {
      throw new Error('apiPassword is missing');
    }

    if (!notificationPassword) {
      throw new Error('notificationPassword is missing');
    }
  }

  _createBillHash() {
    let hashData = this.projectId + this.apiId + this.notificationPassword + new Date().toString();

    return crypto.createHash('md5').update(hashData).digest("hex");
  }

  _createRefundHash() {
    return randomstring.generate(9);
  }

  _createNotificationHash(params) {
    return crypto.createHmac('sha1', this.notificationPassword).update(params).digest("base64");
  }

  _setDefaultRequestOptions(options) {
    options.headers = {
      'accept': 'text/json',
      'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8'
    };
    options.json = true;
    options.auth = {
      user: this.apiId,
      pass: this.apiPassword
    };

    return options;
  }

  beforeCreateBill(billId, data) {
    return Promise.resolve();
  }

  createBill(data) {
    let options = {};
    let billId = this._createBillHash();

    data.ccy = data.ccy || 'RUB';
    data.comment = data.comment || 'bill creation';
    data.prv_name = data.prv_name || 'merchant';
    data.pay_source = data.pay_source || 'qw';
    data.lifetime = data.data || new Date(new Date().getTime() + 1000 * 60 * 60 * 24 * 5).toISOString();

    options.url = `https://api.qiwi.com/api/v2/prv/${this.projectId}/bills/${billId}`;
    options.method = "PUT";
    options.form = data;

    this._setDefaultRequestOptions(options);

    return Promise.resolve().then(() => {
      if (!data.user) {
        throw new Error('Not found user phone');
      }

      if (!data.amount) {
        throw new Error('Not found amount');
      }

      return Promise.resolve(this.beforeCreateBill(billId, data)).then(() => {
        return this.constructor.request(options);
      });
    });
  }

  getPaymentUrl(query) {
    let url = "https://qiwi.com/order/external/main.action";

    if(query) {
      url += ('?' + qs.stringify(query));
    }

    return url;
  }

  getBillStatus(billId) {
    let options = {};

    options.url = `https://api.qiwi.com/api/v2/prv/${this.projectId}/bills/${billId}`;
    options.method = "GET";
    this._setDefaultRequestOptions(options);

    return this.constructor.request(options);
  }

  cancelBill(billId) {
    let options = {};

    options.url = `https://api.qiwi.com/api/v2/prv/${this.projectId}/bills/${billId}`;
    options.method = "PATCH";
    this._setDefaultRequestOptions(options);

    return this.constructor.request(options);
  }

  refundBill(billId, data) {
    let options = {};

    if (typeof data != 'object') {
      data = {amount: data};
    }

    options.url = `https://api.qiwi.com/api/v2/prv/${this.projectId}/bills/${billId}/refund/${this._createRefundHash()}`;
    options.method = "PUT";
    options.form = data;
    this._setDefaultRequestOptions(options);

    return this.constructor.request(options);
  }

  getRefundStatus(billId, refundId) {
    let options = {};

    options.url = `https://api.qiwi.com/api/v2/prv/${this.projectId}/bills/${billId}/refund/${refundId}`;
    options.method = "GET";
    this._setDefaultRequestOptions(options);

    return this.constructor.request(options);
  }

  checkNotificationAuthBasic(req) {
    let data = basicAuth(req) || {};

    return this.notificationPassword && this.projectId && data.name == this.projectId && data.pass == this.notificationPassword;
  }

  checkNotificationAuthSignature(req) {
    let data = req.body || {};
    let values = [];
    let params, hash;

    Object.keys(data).sort().map((key) => {
      values.push(data[key]);
    });

    params = values.join('|');
    hash = this._createNotificationHash(params);

    return hash && (req.get('X-Api-Signature') == hash);
  }

  createXml(code) {
    return xml([{result: [{result_code: code}]}], {declaration: true});
  }

  notify(fn, onError, checkSignature) {
    if (typeof onError == 'boolean') {
      checkSignature = onError;
      onError = undefined;
    }

    return (req, res) => {
      let checkAuth;

      const ok = () => {
        res.set('Content-Type', 'text/xml');
        return res.send(this.createXml(0));
      };

      const fail = (err, code, meta) => {
        res.set('Content-Type', 'text/xml');
        res.status(500);

        if (onError) {
          onError(err, meta);
        }

        return res.send(this.createXml(code || 300));
      };

      if (checkSignature) {
        checkAuth = this.checkNotificationAuthSignature(req);
      }
      else {
        checkAuth = this.checkNotificationAuthBasic(req);
      }

      if (!checkAuth) {
        res.status(401);

        return fail(new Error('Authentication error'), 150, {
          reason: 'authentication',
          type: checkSignature ? 'signature' : 'basic'
        });
      }

      function callback(err) {
        if (err) {
          return fail(err);
        }

        return ok();
      }

      if (!fn) {
        return ok();
      }

      let result = fn.call(this, req.body, callback);

      if (result && typeof result == 'object') {
        result.then(() => {
          ok();
        }).catch((err) => {
          fail(err);
        });
      }
    };
  }
}

module.exports = QiwiShop;
