var forEach = require('lodash.foreach');
var keys = require('lodash.keys');

/**
 * Export all data from an IndexedDB database
 * @param {IDBDatabase} idbDatabase - to export from
 * @param {function(Object, <string|void>)} cb - callback with signature (error, jsonString)
 */
function exportToJsonString(idbDatabase, cb) {
	var exportObject = {};
	if(idbDatabase.objectStoreNames.length === 0)
		cb(null, JSON.stringify(exportObject));
	else {
		var transaction = idbDatabase.transaction(idbDatabase.objectStoreNames, "readonly");
		transaction.onerror = function(event) {
			cb(event, null);
		};
		forEach(idbDatabase.objectStoreNames, function(storeName) {
			var allObjects = [];
			transaction.objectStore(storeName).openCursor().onsuccess = function(event) {
				var cursor = event.target.result;
				if (cursor) {
					allObjects.push(cursor.value);
					cursor.continue();
				} else {
					exportObject[storeName] = allObjects;
					if(idbDatabase.objectStoreNames.length === keys(exportObject).length) {
						cb(null, JSON.stringify(exportObject, exportReplacer));
					}
				}
			};
		});
	}
}

/**
 * The replacer function to be used in the export function
 * @param {string} key - self explanatory
 * @param {*} value - any value connected to the key
 */
function exportReplacer(key, value) {
	if (isArrayBuffer(value)) {
		return '_$AB' + ab2str(value);
	}
	return value;
}

/**
 * Check if the given value is an ArrayBuffer.
 * @param {*} value - The value to check.
 * @returns {boolean} Returns `true` if the given value is an ArrayBuffer, else `false`.
 * @example
 * isArrayBuffer(new ArrayBuffer())
 * // => true
 * isArrayBuffer([])
 * // => false
 */
function isArrayBuffer(value) {
	const hasArrayBuffer = typeof ArrayBuffer === 'function';
	const { toString } = Object.prototype;
	return hasArrayBuffer && (value instanceof ArrayBuffer || toString.call(value) === '[object ArrayBuffer]');
}

/**
 * Convert arraybuffer to string
 * @param {ArrayBuffer} buf - the arraybuffer input
 * @return {string} 
 * todo: add another paramter for the agreed upon representation, so 
 * that multiple representations may be supported: e.g. UInt16Array in 
 * addition to the current UInt8Array.
 */
function ab2str(buf) {
	return String.fromCharCode.apply(null, new Uint8Array(buf));
}

/**
 * Convert string to arraybuffer
 * @param {string} str - the string input
 * @return {Arraybuffer} 
 * todo: add another paramter for the agreed upon representation, so 
 * that multiple representations may be supported: e.g. UInt16Array in 
 * addition to the current UInt8Array.
 */
function str2ab(str) {
	var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
	var bufView = new Uint8Array(buf);
	for (var i=0, strLen=str.length; i < strLen; i++) {
		bufView[i] = str.charCodeAt(i);
	}
	return buf;
}

/**
 * Import data from JSON into an IndexedDB database. This does not delete any existing data
 *  from the database, so keys could clash
 *
 * @param {IDBDatabase} idbDatabase - to import into
 * @param {string} jsonString - data to import, one key per object store
 * @param {function(Object)} cb - callback with signature (error), where error is null on success
 */
function importFromJsonString(idbDatabase, jsonString, cb) {
	var transaction = idbDatabase.transaction(idbDatabase.objectStoreNames, "readwrite");
	transaction.onerror = function(event) {
		cb(event);
	};
	var importObject = JSON.parse(jsonString, importResolver);
	forEach(idbDatabase.objectStoreNames, function(storeName) {
		var count = 0;
		forEach(importObject[storeName], function(toAdd) {
			var request = transaction.objectStore(storeName).add(toAdd);
			request.onsuccess = function(event) {
					count++;
					if(count === importObject[storeName].length) { // added all objects for this store
						delete importObject[storeName];
						if(keys(importObject).length === 0) // added all object stores
							cb(null);
					}
				}
		});
	});
}

/**
 * The replacer function to be used in the export function
 * @param {string} key - self explanatory
 * @param {*} value - any value connected to the key
 */
function importResolver(key, value) {
	if (typeof value === 'string' && value.startsWith('_$AB')) {
		var valueWithoutPrefix = value.slice(4);
		return str2ab(valueWithoutPrefix);
	}
	return value;
}

/**
 * Clears a database of all data
 *
 * @param {IDBDatabase} idbDatabase - to delete all data from
 * @param {function(Object)} cb - callback with signature (error), where error is null on success
 */
function clearDatabase(idbDatabase, cb) {
	var transaction = idbDatabase.transaction(idbDatabase.objectStoreNames, "readwrite");
	transaction.onerror = function(event) {
		cb(event);
	};
	var count = 0;
	forEach(idbDatabase.objectStoreNames, function(storeName) {
		transaction.objectStore(storeName).clear().onsuccess = function() {
			count++;
			if(count === idbDatabase.objectStoreNames.length) // cleared all object stores
				cb(null);
		};
	});
}

module.exports = {
	exportToJsonString : exportToJsonString,
	importFromJsonString : importFromJsonString,
	clearDatabase : clearDatabase
};
