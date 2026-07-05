import http from 'https';

const data = JSON.stringify({ phone: '+251910000002', password: 'testpassword' });

const req = http.request('https://www.betverset.com/api/auth/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('BODY:', body));
});

req.on('error', console.error);
req.write(data);
req.end();
