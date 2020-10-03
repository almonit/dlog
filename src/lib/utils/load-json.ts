export default function loadJSON(url: string): Promise<any> {
  return new Promise(function(resolve, reject) {
    fetch(url)
      .then(function(response) {
        return response.json();
      })
      .then(function(data) {
        resolve(data);
      })
      .catch(function(e) {
        console.error('LoadJSON error: ', e);
        reject(null);
      });
  });
}
