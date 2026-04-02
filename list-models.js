const url = 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyD2fSLmUAWqnLzpgqoUvpNMxiJu7uVaEQQ';
fetch(url).then(r => r.json()).then(data => {
  if (data.models) {
    console.log(data.models.map(m => m.name).join('\n'));
  } else {
    console.log(data);
  }
}).catch(console.error);
