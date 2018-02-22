//file for /price related routes
const express = require('express');
const router = express.Router();
var axios = require('axios');

//object to store APIURLs and paths to prices within JSON response
var XRPAPIInfo = require("./XRPAPIInfo.json");

router.get('/:pair?/:exchange?/:bidask?', function (req, res) {

  //function to standardize calls to api so code is more readable
  function standardAPITicker(APIURL, bidPath = '', askPath = '', lastPath = '', callback) {
    axios.get(APIURL)
      .then((APIres) => {
        var status = parseInt(APIres.status);

        if (status == 200) {

          //store different prices from response
          var prices = {};

          //loop through function arguments for paths to price types
          for (var arg in arguments) {
            if (arg > 0 && arg < 4) { // if we are one of the path arguments
              //set price type
              var priceType = 'bid';
              if (arg == 2) priceType = 'ask';
              else if (arg == 3) priceType = 'last';

              //set right path, fetch price from response and store in prices object
              var typePath = arguments[arg];
              if (typePath.length > 0) {
                //non-standard path
                prices[priceType] = APIres.data;
                var pathArr = typePath.split('.');
                for (var pathNode in pathArr) { //pathNode = index of JSON node in pathArr
                  prices[priceType] = prices[priceType][pathArr[pathNode]];
                }
                prices[priceType] = parseFloat(prices[priceType]);
              } else prices[priceType] = parseFloat(APIres.data[priceType]); //standard path in JSON response

            }
          }
          //return success status code and prices object
          return callback({
            APIStatusCode: status,
            prices: prices
          });
        }
        //if res statuscode was not 200, return code and an error message
        return callback({
          APIStatusCode: status,
          message: 'API returned bad status code'
        });
      })
      .catch((err) => {
        //alert user there was a server error
        return callback({
          APIStatusCode: 404,
          message: String(err)
        });
      });
  }


  //general /price route
  if (!req.params.pair) {

    var resObj = {};

    console.log("no pair");
    var exchangeNum = 0;
    var pairNum = 0;
    // var exchangeInd = 0;
    // var exchangeObj = XRPAPIInfo[Object.keys(XRPAPIInfo)[exchangeInd]];

    for (var exchange in XRPAPIInfo) {
      if (XRPAPIInfo.hasOwnProperty(exchange)) {
        exchangeNum++;
        pairNum = 0;
        var exchangeObj = XRPAPIInfo[exchange];
        // resObj[exchange] = {};
        for (var pair in exchangeObj) {
          if (exchangeObj.hasOwnProperty(pair)) {
            // pairNum++;

            // resObj[exchange][pair] = {};


            function callAndStore() {
              //array of exchange's info from json object of xrp api info
              var pairArr = exchangeObj[pair];
              //path to bid price, ask price, last price
              var pairURL = pairArr[0];
              var bidPath = pairArr[1];
              var askPath = pairArr[2];
              var lastPath = pairArr[3];
              standardAPITicker(pairURL, bidPath, askPath, lastPath, (APIresp) => {
                console.log("pair: " + pair);
                pairNum++;
                if(resObj[exchange]) resObj[exchange][pair] = APIresp;
                else{ resObj[exchange] = {}; resObj[exchange][pair] = APIresp; }
                if (exchangeNum == Object.keys(XRPAPIInfo).length) {
                  console.log("exchangeNum: " + exchangeNum + ", exchange: " + exchange);
                  if (pairNum == Object.keys(exchangeObj).length) {
                    console.log("pairnum: " + pairNum + ", pair: " + pair);
                    // return res.json(resObj);
                  }
                }
              });
            }
            // resObj[exchange][pair] = APIresp;
            callAndStore();
          }

        }
      }


    }
    console.log("outside loop");
    // if(done) 
    setTimeout(() => { return res.json(resObj) }, 400);
  }

  //user supplied specific pair and exchange
  else {
    var exchangeObj = XRPAPIInfo[req.params.exchange]; //pulls exchange object from XRPAPIInfo object
    //pulls ticker url, paths of vars in resp from exchangeObj based on req.params
    var tickerInfoArr = exchangeObj[req.params.pair];
    //call standard API calling function with this info

    //binance doesn't have same endpoint for last price and bid/ask so, have to deal with that:
    if (req.params.exchange == "binance") {
      resObj = {};

      standardAPITicker("https://api.binance.com/api/v3/ticker/price?symbol=" +
        req.params.pair, "", "", "price", function (lastResp) {

          standardAPITicker(tickerInfoArr[0], tickerInfoArr[1], tickerInfoArr[2], tickerInfoArr[3], function (APIresp) {
            bidAskResp = APIresp;
            resObj = {};

            if (bidAskResp.APIStatusCode == 200) {
              resObj = bidAskResp;
              //check if lastRest's price or error needs to be appended
              if (lastResp.APIStatusCode == 200) {
                resObj.prices.last = lastResp.prices.last;
              } else {
                resObj.prices.last = lastResp.message;
              }
            } else {
              if (lastResp.APIStatusCode == 200) {
                resObj = lastResp;
                resObj.prices.bid = bidAskResp.message;
                resObj.prices.ask = bidAskResp.message;
              } else resObj = lastResp;
            }
            //return combined JSON
            return res.json({
              pair: req.params.pair,
              exchange: req.params.exchange,
              response: resObj
            });
          });
        });

    }

    //any other exchange other than binance has one endpoint for last, ask, bid
    else {
      if (tickerInfoArr) {
        standardAPITicker(tickerInfoArr[0], tickerInfoArr[1], tickerInfoArr[2], tickerInfoArr[3], function (APIresp) {
          return res.json({
            pair: req.params.pair,
            exchange: req.params.exchange,
            response: APIresp
          });
        });
      } else {
        return res.json({
          status: 404,
          message: "Exchange or pair not found. call /api/price for a full list of exchanges and pairs."
        });
      }
    }

  }

});

module.exports = router;