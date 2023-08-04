const router = require('express').Router();
const axios = require('axios').default;
const https = require('https');

// At request level
const agent = new https.Agent({
    rejectUnauthorized: false
});



module.exports = async(req, res) => {
    try {
        const API = {
            getList: 'https://api.us.navixy.com/v2/tracker/list',
            getInfo: 'https://api.us.navixy.com/v2/tracker/read',
            getReadings: 'http://gps.tecnobus.cl/api-v2/tracker/readings/list',
            getState: 'http://gps.tecnobus.cl/api-v2/tracker/get_state'
        }

        const hash = req.query.hash
        const listDevices = await axios.get(`${API.getList}?hash=${hash}`, { httpsAgent: agent });

        if(!listDevices.data.success){
            return res.status(400)
                .json({ success: true, message: 'No se logro obtener la lista de dispositivos' });
        }

        const _rawDevices = listDevices.data.list;
        let devices = [];

        for(let device of _rawDevices){

            const promise = await Promise.all([
                await axios.get(`${API.getReadings}?tracker_id=${device.id}&hash=${hash}`, { httpsAgent: agent }),
                await axios.get(`${API.getState}?tracker_id=${device.id}&hash=${hash}`, { httpsAgent: agent })
            ])

            let _device   = promise[0].data;
            let _rawState = promise[1].data;

            device['inputs'] = _device.inputs || [];
            device['states'] = _device.states || [];
            device['state_device']  = _rawState.state || [];
            const canSpeed          = device['inputs'].find((input) => input.name  == 'can_speed') || {};

            device['velocidad_can_label'] = canSpeed.label || null;
            device['velocidad_can_name']  = canSpeed.name || null;
            device['velocidad_can_value'] = canSpeed.value || 0;
            device['velocidad_can_units_type'] = canSpeed.units_type || 0;
            device['velocidad_can_update_time'] = canSpeed.update_time;

            const stateTrack = device['states'].find((input) => input.field == 'actual_track') || {};
            device['state_track_field']   = stateTrack.field || null ;
            device['state_track_value']   = stateTrack.value || 0 ;

            devices.push(device);
        }

        res.status(200).json({ success: true, message: 'Ok', data: devices });

    } catch (error) {
        console.log(error)
        res.status(400).json({ success: false, message: 'Error' });
    }

}