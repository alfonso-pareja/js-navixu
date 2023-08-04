const axios = require("axios");

const BASE_URL = "https://apigps.fiordoaustral.com";
const HASH_API = "616c1befc270f3e662ae1cb0df89d030";

const getAlertsList = async () => {
  const url = `${BASE_URL}/history/unread/list?hash=${HASH_API}`;
  const response = await axios.get(url);
  const data = response.data;

  const alarmas = data.list.map((item) => item.message);
  const patentesSet = new Set(
    data.list.map((item) => item.extra.tracker_label)
  );
  const patentes = Array.from(patentesSet);
  const recuento_patentes = patentes.map((patente) => ({
    patente,
    cantidad: data.list.filter((item) => item.extra.tracker_label === patente)
      .length
  }));
  const patentes_ordenadas = patentes.sort(
    (a, b) =>
      recuento_patentes.find((item) => item.patente === b).cantidad -
      recuento_patentes.find((item) => item.patente === a).cantidad
  );
  const recuento_ordenado = recuento_patentes.sort(
    (a, b) => b.cantidad - a.cantidad
  );
  const localizaciones = data.list.map((item) => ({
    patente: item.extra.tracker_label,
    location_lat: item.location.lat,
    location_lng: item.location.lng,
    location_address: item.location.address
  }));

  return ({
    alarm_list: alarmas,
    plate_list: patentes_ordenadas,
    plate_count_list: recuento_ordenado,
    plate_location_list: localizaciones
  })
};

module.exports = { getAlertsList };
