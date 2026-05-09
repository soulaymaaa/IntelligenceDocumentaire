const officeparser = require('officeparser');
const path = require('path');

async function test() {
  try {
    console.log('Testing officeparser...');
    // We don't have a real file, but we can check if the functions exist
    console.log('parseOfficeAsync exists:', typeof officeparser.parseOfficeAsync === 'function');
    console.log('parseOffice exists:', typeof officeparser.parseOffice === 'function');
  } catch (err) {
    console.error(err);
  }
}

test();
