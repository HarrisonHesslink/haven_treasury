const Discord = require('discord.js');
let request = require('request');
var cheerio = require("cheerio");
var Twitter = require('twitter');
var emoji = require('node-emoji')
var snapdb = require('snap-db')

const bird = new Twitter({
    consumer_key: process.env.KEY,
    consumer_secret: process.env.SECRET,
    access_token_key: process.env.TOKEN_KEY,
    access_token_secret: process.env.TOKEN_SECRET
  });

const client = new Discord.Client();

var global_height = 0;
const coin = 1000000000000.0;

function setSupplyForDiscord() {
    let site = await grab_site();
    let $ = cheerio.load(site)
    let xUSD_supply = 0;
    let xhv_supply = 0;

    let counter = 0;
    $("td").each(function() {
        let link = $(this);
        let text = link.text();
        if(link.attr("style")  == "text-align:left")
        {
            counter++;
        }
        if(link.attr("style") == "text-align:right")
        {
            if(counter == 1)
            {
                xhv_supply = parseFloat(text);

            }
            if(counter == 2)
            {
                xUSD_supply = parseFloat(text);
            }
        }

    });
    const actvs = [
        numberWithCommas(xUSD_supply) + " xUSD",
        numberWithCommas(xhv_supply) + " XHV",
        numberWithCommas(xUSD_supply) + " xUSD",
        numberWithCommas(xhv_supply) + " XHV"
    ];
    client.user.setActivity(actvs[Math.floor(Math.random() * (actvs.length - 1) + 1)]);
}

function getParsedBlock(height) {
    let block_ = await get_block(height);
    return JSON.parse(block_);;
}

async function tweet(tmessage) 
{
    bird.post('statuses/update', {status: tmessage}, function(error, message, response) {
    if (!error) {
        console.log("tweet")
    }
    });
}

async function sendMessage(message) {
    //harrisons test channel
    if(client.channels.cache.get(""))
        client.channels.cache.get("").send(message)
    //havens channel rip
    if(client.channels.cache.get(""))
        client.channels.cache.get("").send(message)
  }

async function get_top ()
{
    return new Promise(function(resolve, reject) {
        
        request.post({
            headers: {'content-type': 'application/json'},
            url: 'http://127.0.0.1:17750/json_rpc',
            form: '{"jsonrpc":"2.0","id":"0","method":"get_last_block_header"}'
        }, function(error, response, body){
            resolve(body)
        });
      })
}

async function get_txes_data (txes)
{
    return new Promise(function(resolve, reject) {
        
        request.post({
            headers: {'content-type': 'application/json'},
            url: 'http://127.0.0.1:17750/get_transactions',
            form:'{"txs_hashes":' + txes + ',"decode_as_json":true, "prune": true}'
        }, function(error, response, body){
            resolve(body)
        });
      })
}
async function get_block (height)
{
    return new Promise(function(resolve, reject) {
        
        request.post({
            headers: {'content-type': 'application/json'},
            url: 'http://127.0.0.1:17750/json_rpc',
            form: '{"jsonrpc":"2.0","id":"0","method":"get_block","params":{"height": ' + height + '}}'
        }, function(error, response, body){
            resolve(body)
        });
      })
}

async function grab_site ()
{
    return new Promise(function(resolve, reject) {
        
        request({
            uri: 'https://explorer.havenprotocol.org/supply',
        }, function(error, response, body){
            resolve(body)
        });
      })
}


function numberWithCommas(x) {
    return x.toString().replace(/\B(?<!\.\d*)(?=(\d{3})+(?!\d))/g, ",");
}

function parseTransactions(txes) {
        let tx_data_ = await get_txes_data(txes);

        let tx_data = JSON.parse(tx_data_).txs;
        
        if(tx_data.length)
        {
            for(var i = 0; i < tx_data.length;i++)
            {
                let tx_json = JSON.parse(tx_data[i].as_json);

                if(!tx_json.amount_burnt)
                    continue;
                if(!tx_json.amount_minted)
                    continue;
                
                console.log("Amount Minted: " + tx_json.amount_minted / coin);
                console.log("Amount Burned: " + tx_json.amount_burnt / coin);

                let m_amount = tx_json.amount_minted / coin;
                let b_amount = tx_json.amount_burnt / coin;
                
                let pr_block_ = await get_block(tx_json.pricing_record_height);
                let pr_block = JSON.parse(pr_block_);
                let rate = pr_block.result.block_header.pricing_record.unused1 / coin

                let message = "";
                if(tx_json.rct_signatures.txnOffshoreFee != 0)
                {
                    let fee = tx_json.rct_signatures.txnOffshoreFee / coin;
                    let time_for_unlock = (tx_json.unlock_time - global_height) / 720
                    let date_time_for_unlock = new Date(Date.now() + time_for_unlock * 86400000);

                    message = emoji.get('dollar') + emoji.get('dollar') + emoji.get('dollar') + " $" +  numberWithCommas(m_amount.toFixed(2)) + " $xUSD minted at someone's wallet! \n"+ numberWithCommas(b_amount.toFixed(2)) + " $XHV were burned. \n \nPricing Record: $" + rate.toFixed(4) + " / XHV  \nFees Paid: " +  numberWithCommas(fee.toFixed(4)) + " XHV\nUnlock Date: "
                    if(m_amount >= 100)
                    {
                        if(message != "")
                            //await sendMessage(message);

                        if(m_amount >= 1000)
                        {
                            //await tweet(message);
                        }
                    }

                }

                if(tx_json.rct_signatures.txnOffshoreFee_usd != 0)
                {

                    let time_for_unlock = (global_height - tx_json.unlock_time) / 720
                    let date_time_for_unlock = Date.now() + time_for_unlock;
                    let fee = tx_json.rct_signatures.txnOffshoreFee_usd / 1000000000000;

                    message = emoji.get('fire') + emoji.get('fire') + emoji.get('fire') + " $" +  numberWithCommas(b_amount.toFixed(2)) + " $xUSD burned at someone's wallet \n"+  numberWithCommas(m_amount.toFixed(2)) + " $XHV were minted. \n \nPricing Record: $" + rate.toFixed(4) + " / XHV \nFees Paid: $" +  numberWithCommas(fee.toFixed(4)) + " xUSD"
                    if(b_amount >= 100)
                    {
                        if(message != "")
                           await sendMessage(message);

                        if(b_amount >= 1000)
                        {
                            await tweet(message);
                        }
                        
                    }
                }
            }
        }
}

async function init ()
{     
    client.login(process.env.DISCORD_CLIENT);
    let topBlockData = await get_top();
    let topHeight = JSON.parse(topBlockData).result.block_header.height;

    if(global_height != topHeight || global_height == 0)
    {
        console.log("Checking block: " + topHeight)
        global_height = topHeight;

        setSupplyForDiscord();

        
        let parsedBlock =  getParsedBlock(topHeight);   

        let txes = JSON.stringify(parsedBlock.result.tx_hashes)
        if(txes)
        {
            parseTransactions(txes);
        }
    }
}

client.on("ready", () =>{
    init()
    setInterval(init, 20000);
});
