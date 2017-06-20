var fs = require('fs');
var Web3 = require('web3');
var toml = require('toml');

var tomlPath = '../node.toml';
var specPath = '../spec.json';

var config = getConfig();

transferRewardToPayoutKey();

function transferRewardToPayoutKey() {
	var specData = JSON.parse(fs.readFileSync(specPath, 'utf8'));
	findKeys(specData, function(tomlData, miningKey, payoutKey) {
		console.log("miningKey = " + miningKey);
		console.log("payoutKey = " + payoutKey);
		if (!miningKey || !payoutKey)
			return console.log({code: 500, title: "Error", message: "Payout key or mining key or both are undefined"});
		transferRewardToPayoutKeyInner(specData, tomlData, miningKey, payoutKey);
	});
}

function findKeys(specData, cb) {
	var tomlDataStr = fs.readFileSync(tomlPath, 'utf8');

	var tomlData = toml.parse(tomlDataStr);
	var miningKey = tomlData.mining.engine_signer;
	retrievePayoutKey(specData, tomlData, miningKey, function(payoutKey) {
		cb(tomlData, miningKey, payoutKey);
	});
}

function retrievePayoutKey(specData, tomlData, miningKey, cb) {
	attachToContract(specData, tomlData, function(err, web3, contract) {
		contract.miningPayoutKeysPair.call(miningKey, function(err, payoutKey) {
			cb(payoutKey);
		});
	});
}

function transferRewardToPayoutKeyInner(specData, tomlData, miningKey, payoutKey) {
	configureWeb3(tomlData, function(err, web3, defaultAccount) {
		if (err) return console.log(err);

	  	transferRewardToPayoutKeyTX(web3, miningKey, payoutKey, function(err, result) {
	  		if (err) {
	  			console.log("Something went wrong with transferring reward to payout key");
	  			console.log(err.message);
	  			return;
	  		}

	  		console.log("Reward is sent to payout key (0x" + payoutKey + ") from mining key (0x" + miningKey + ")");
	  	});
  	});
};

function getConfig() {
	var config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
	return config;
}

function configureWeb3(tomlData, cb) {
	var web3;
	if (typeof web3 !== 'undefined') web3 = new Web3(web3.currentProvider);
	else web3 = new Web3(new Web3.providers.HttpProvider(config.Ethereum[config.environment].rpc));

	if(!web3.isConnected()) {
		var err = {code: 500, title: "Error", message: "check RPC"};
		cb(err, web3);
	} else {
		web3.eth.defaultAccount = tomlData.mining.engine_signer;
		cb(null, web3);
	}
}

function attachToContract(specData, tomlData, cb) {
	configureWeb3(tomlData, function(err, web3) {
		if (err) return console.log(err);

		var contractABI = config.Ethereum.contracts.Oracles.abi;
		var contractAddress = specData.engine.authorityRound.params.validators.contract;

		var MyContract = web3.eth.contract(contractABI);

		contract = MyContract.at(contractAddress);
		
		if (cb) cb(null, web3, contract);
	});
}

function transferRewardToPayoutKeyTX(web3, _from, _to, cb) {
	var balance = web3.eth.getBalance(_from).toNumber(10);
	console.log("balance from: " + balance);
	var gasPrice = web3.eth.gasPrice;
	console.log("gas price: " + gasPrice.toString(10));
	var estimatedGas = web3.eth.estimateGas({from: _from, to: _to, value: balance});
	console.log("estimated gas: " + estimatedGas);
	var ammountToSend = balance - estimatedGas * gasPrice;
	console.log("ammount to transfer: " + ammountToSend);
	web3.eth.sendTransaction({gas: estimatedGas, from: _from, to: _to, value: ammountToSend}, function(err, result) {
		cb(err, result);
	});
}
