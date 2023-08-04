const axios = require("axios");
const { BASE_URL, HASH_API } = require("../../utils/constants");

/**
 * MAIN
 * @returns 
 */
const getInfoNavixy = async () => {
  try {
    const trackers = await getTrackerListFiltered();
    const taskList = await getTrackersTaskList();

    const formattedResponse = [];
    for (const task of taskList) {
      const tracker = trackers.find((track) => track.id === task.tracker_id);
      const localNow = new Date();
      const santiagoTimeZone = "America/Santiago";
      const santiagoNow = localNow.toLocaleString("en-US", {
        timeZone: santiagoTimeZone
      });

      const startLat = task.checkpoint_start.lat;
      const startLng = task.checkpoint_start.lng;
      const endLat = task.checkpoint_end.lat;
      const endLng = task.checkpoint_end.lng;

      const trackLocation = await getTrackerLocation(task.tracker_id);
      const currentLat = trackLocation.track_location_lat;
      const currentLng = trackLocation.track_location_lng;

      const taskStatus = calculateTaskStatus(task, currentLat, currentLng);
      const estimatedTime = await getDistanceService(
        startLat,
        startLng,
        endLat,
        endLng
      );

      const estimatedTimeArribal = await calculateDynamicDistanceTime(
        currentLat,
        currentLng,
        task.checkpoints
      );

      console.log(estimatedTime)

      let formattedTask = {
        estimated_time_fijo: "4h 28m",
        estimated_time: estimatedTime[1],
        estimated_time_arrival: estimatedTimeArribal[1],
        initial_route_name: task.checkpoint_start.label,
        destination_route_name: task.checkpoint_end.label,
        arrival_date_first_check: task.checkpoint_start.arrival_date,
        arrival_date_last_check: task.checkpoint_end.arrival_date,
        route_name: task.route_name,
        tracker_location_lat: currentLat,
        tracker_location_lng: currentLng,
        tracker_device_movement: trackLocation.tracker_device_movement,
        tracker_label: tracker.label,
        tracker_speed: trackLocation.tracker_speed,
        task_name: task.route_name,
        task_status: task.status_task,
        state: taskStatus,
        date: santiagoNow
      };

      if (taskStatus === "Arribado") {
        const timeToArrive = timeDiff(task.checkpoint_end.arrival_date);
        if (timeToArrive) {
          formattedTask.estimated_time = "7h 15m";
          formattedTask.estimated_time_arrival = "0m";
        }
      }

      formattedResponse.push(formattedTask);
    }

    const sortedResponse = formattedResponse.sort(statusSortKey);
    return sortedResponse;
  } catch (error) {
    console.log(error);
    throw new Error("Failed to fetch data");
  }
};

function statusSortKey(task) {
  const statusOrder = {
    assigned: 0,
    done: 1,
    failed: 2
    // Agrega otros estados que puedas tener aquí con sus respectivos valores numéricos
  };
  return statusOrder[task.task_status] || 99;
}

calculateDynamicDistanceTime = async (
  current_lat,
  current_lng,
  checkpoints
) => {
  let total_distance = 0;
  let total_time_in_minutes = 0;

  // Encuentra el índice del siguiente punto no completado (que aún no ha sido visitado)
  let next_uncompleted_index = -1;
  for (let index = 0; index < checkpoints.length; index++) {
    if (checkpoints[index].status !== "done") {
      next_uncompleted_index = index;
      break;
    }
  }

  // Si se encontró un siguiente punto no completado
  if (next_uncompleted_index !== -1) {
    // Calcula la distancia y el tiempo estimado desde la ubicación actual hasta ese punto no completado
    const next_checkpoint = checkpoints[next_uncompleted_index];
    const checkpoint_lat = next_checkpoint.lat;
    const checkpoint_lng = next_checkpoint.lng;
    const distance_to_next_checkpoint = haversineDistance(
      current_lat,
      current_lng,
      checkpoint_lat,
      checkpoint_lng
    );
    const time_to_next_checkpoint = timeToReachDestination(
      distance_to_next_checkpoint,
      47
    );

    total_distance += distance_to_next_checkpoint;
    total_time_in_minutes += time_to_next_checkpoint * 60;

    // Actualiza la ubicación actual con la ubicación del siguiente punto no completado
    current_lat = checkpoint_lat;
    current_lng = checkpoint_lng;
  }

  // Convierte el tiempo total de minutos a días, horas y minutos
  const days = Math.floor(total_time_in_minutes / (24 * 60));
  const remainder = total_time_in_minutes % (24 * 60);
  const hours = Math.floor(remainder / 60);
  const minutes = remainder % 60;

  const formatted_time = formatTime1(days, hours, minutes);
  return [total_distance, formatted_time];
};

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Radio de la Tierra en kilómetros
  const lat1_rad = degToRad(lat1);
  const lon1_rad = degToRad(lon1);
  const lat2_rad = degToRad(lat2);
  const lon2_rad = degToRad(lon2);
  const dlat = lat2_rad - lat1_rad;
  const dlon = lon2_rad - lon1_rad;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

function timeToReachDestination(distance, average_speed) {
  return distance / average_speed;
}

function formatTime1(days, hours, minutes) {
  let formatted_time = "";
  if (days > 0) {
    formatted_time += `${parseInt(days, 10)}d `;
  }
  if (hours > 0) {
    formatted_time += `${parseInt(hours, 10)}h `;
  }
  formatted_time += `${parseInt(minutes, 10)}m`;
  return formatted_time;
}

getDistanceService = async (start_lat, start_lng, end_lat, end_lng) => {
  const url = `${BASE_URL}/route/get`;

  const body = {
    pgk: "",
    start: {
      lat: start_lat,
      lng: start_lng
    },
    end: {
      lat: end_lat,
      lng: end_lng
    },
    waypoints: [],
    provider_type: "osrm",
    point_limit: 512,
    hash: HASH_API
  };

  try {
    const response = await axios.post(url, body);

    if (response.status === 200) {
      const data = response.data;
      const result = data.key_points[1];

      console.log(result)
      return [metersToKilometers(result.distance), formatTime(result.time)];
    } else {
      console.log("Error:", response.data);
      return [0, 0];
    }
  } catch (error) {
    console.log("Error:", error.message);
    return [0, 0];
  }
};

function metersToKilometers(meters) {
  return meters / 1000;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const remainingSeconds = seconds % 3600;
  const minutes = Math.floor(remainingSeconds / 60);
  return `${hours}h ${minutes}m`;
}

const calculateTaskStatus = async (task, current_lat, current_lng) => {
  if (task.checkpoints[task.checkpoints.length - 1].status === "done") {
    return "Arribado";
  }

  const estimatedTimeToFirst = calculateTimeEstimation(
    task.checkpoints[0].lat,
    task.checkpoints[0].lng,
    current_lat,
    current_lng
  )[1];

  if (estimatedTimeToFirst >= 30) {
    return "Transito";
  }

  if (task.checkpoints[0].status === "done") {
    return "Iniciada";
  }

  return "";
};

const getTrackerLocation = async (trackerId) => {
  try {
    const url = `${BASE_URL}/tracker/get_state?tracker_id=${trackerId}&hash=${HASH_API}`;
    const response = await axios.get(url);

    if (response.status === 200) {
      const data = response.data;
      return {
        track_location_lat: data.state.gps.location.lat,
        track_location_lng: data.state.gps.location.lng,
        tracker_speed: data.state.gps.speed,
        tracker_device_status: data.state.connection_status,
        tracker_device_movement: data.state.movement_status
      };
    } else {
      throw new Error("Failed to fetch data");
    }
  } catch (error) {
    throw new Error("Failed to fetch data");
  }
};

const getTrackersTaskList = async () => {
  try {
    const current_date = new Date();
    const tomorrow_date = new Date(current_date);
    tomorrow_date.setDate(current_date.getDate() + 1);

    const from_date_str =
      current_date.toISOString().split("T")[0] + " 00:00:00";
    const to_date_str = tomorrow_date.toISOString().split("T")[0] + " 23:59:59";

    const body = {
      from: from_date_str,
      to: to_date_str,
      types: ["route"],
      sort: [
        "to=desc"
      ],
      hash: HASH_API
    };

    const url = `${BASE_URL}/task/list`;
    const response = await axios.post(url, body);

    if (response.status === 200) {
      const data = response.data;
      return data.list.map(extractDataTaskList);
    } else {
      throw new Error("Failed to fetch data");
    }
  } catch (error) {
    throw new Error("Failed to fetch data");
  }
};

const extractDataTaskList = (item) => {
  const checkpointsData = item.checkpoints.map((checkpoint) => ({
    tracker_id: checkpoint.tracker_id,
    status: checkpoint.status,
    label: checkpoint.label,
    description: checkpoint.description,
    origin: checkpoint.origin,
    lat: checkpoint.location.lat,
    lng: checkpoint.location.lng,
    address: checkpoint.location.address,
    arrival_date: checkpoint.arrival_date,
    id: checkpoint.id
  }));

  return {
    checkpoints: checkpointsData,
    checkpoint_start: checkpointsData[0] || null,
    checkpoint_end: checkpointsData[checkpointsData.length - 1] || null,
    tracker_id: item.tracker_id,
    status_task: item.status,
    status_label: statusText(item.status),
    route_name: item.label
  };
};

const statusText = (status) => {
  if (status === "failed") {
    return "no completado";
  } else if (status === "assigned") {
    return "asignado";
  } else if (status === "done") {
    return "completado";
  } else {
    return status;
  }
};

const getTrackerListFiltered = async () => {
  try {
    const url = `${BASE_URL}/tracker/list?hash=${HASH_API}`;
    const response = await axios.get(url);

    if (response.status === 200) {
      const data = response.data;
      return data.list.map((item) => ({ id: item.id, label: item.label }));
    } else {
      throw new Error("Failed to fetch data");
    }
  } catch (error) {
    throw new Error("Failed to fetch data");
  }
};

function calculateTimeEstimation(
  current_lat,
  current_lng,
  next_lat,
  next_lng,
  average_speed
) {
  const distance_to_next_checkpoint = haversineDistance(
    current_lat,
    current_lng,
    next_lat,
    next_lng
  );
  const time_to_next_checkpoint = timeToReachDestination(
    distance_to_next_checkpoint,
    average_speed
  );

  const formatted_time = formatTime2(time_to_next_checkpoint);
  return formatted_time;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Radio de la Tierra en kilómetros
  const lat1_rad = degToRad(lat1);
  const lon1_rad = degToRad(lon1);
  const lat2_rad = degToRad(lat2);
  const lon2_rad = degToRad(lon2);
  const dlat = lat2_rad - lat1_rad;
  const dlon = lon2_rad - lon1_rad;
  const a =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1_rad) * Math.cos(lat2_rad) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
}

function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

function timeToReachDestination(distance, average_speed) {
  return distance / average_speed;
}

function formatTime2(time_in_hours) {
  const hours = Math.floor(time_in_hours);
  const minutes = Math.round((time_in_hours - hours) * 60);

  let formatted_time = "";
  if (hours > 0) {
    formatted_time += `${hours}h `;
  }
  formatted_time += `${minutes}m`;
  return formatted_time;
}

module.exports = {
  getInfoNavixy
};
