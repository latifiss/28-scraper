const https = require('https');

const url = 'https://dev.kwayisi.org/apis/gse/live';

https
  .get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log(json);
      } catch (err) {
        console.error('Error parsing JSON:', err.message);
      }
    });
  })
  .on('error', (err) => {
    console.error('Request error:', err.message);
  });
