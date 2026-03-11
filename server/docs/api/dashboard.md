# Dashboard Module API Documentation

The Dashboard module provides system monitoring and control capabilities, designed to support NAS-like management interfaces.

## Base URL
`/api/dashboard`

## Authentication
All endpoints require `admin` role access.
- Header: `Authorization: Bearer <token>`

---

## 1. System Statistics

### Get Dashboard Stats
Retrieves comprehensive system information including hardware status, network usage, storage, and Docker containers.

- **Endpoint**: `GET /stats`
- **Permission**: Admin

#### Response Structure
```json
{
  "usersCount": 1,
  "mountsCount": 2,
  "system": {
    "platform": "linux",
    "distro": "Ubuntu",
    "release": "22.04",
    "hostname": "my-nas",
    "arch": "x64",
    "uptime": 3600,
    "timezone": "Asia/Shanghai",
    "time": 1704355200000,
    "cpu": {
      "manufacturer": "Intel",
      "brand": "Core i7-10700",
      "speed": 2.9,
      "cores": 16,
      "physicalCores": 8,
      "load": 15.5,
      "loadUser": 10.2,
      "loadSystem": 5.3,
      "temperature": 45.0
    },
    "memory": {
      "total": 16777216,
      "free": 8388608,
      "used": 8388608,
      "active": 4194304,
      "available": 10485760,
      "swaptotal": 4194304,
      "swapused": 0,
      "swapfree": 4194304
    },
    "storage": {
      "mounts": [
        {
          "fs": "/dev/sda1",
          "type": "ext4",
          "size": 1000000000,
          "used": 500000000,
          "use": 50.0,
          "mount": "/"
        }
      ],
      "disks": [
        {
          "device": "/dev/sda",
          "type": "SSD",
          "name": "Samsung 970 EVO",
          "vendor": "Samsung",
          "size": 1000204886016,
          "serialNum": "S46ENX0M...",
          "interfaceType": "NVMe",
          "smartStatus": "Ok"
        }
      ]
    },
    "network": {
      "interfaces": [
        {
          "name": "eth0",
          "address": "192.168.1.100",
          "mac": "00:11:22:33:44:55",
          "type": "wired",
          "speed": 1000
        }
      ],
      "speed": {
        "rx_sec": 102400,
        "tx_sec": 51200
      }
    },
    "docker": {
      "active": true,
      "containers": 5,
      "running": 3,
      "paused": 0,
      "stopped": 2,
      "images": 10,
      "details": [
        {
          "id": "a1b2c3d4e5",
          "name": "plex-server",
          "image": "plexinc/pms-docker",
          "state": "running",
          "status": "Up 2 hours",
          "created": 1704268800,
          "ports": [32400]
        }
      ]
    }
  }
}
```

---

## 2. System Control

### Power Management
Control the physical power state of the server.

- **Endpoint**: `POST /power/:action`
- **Permission**: Admin
- **Parameters**:
  - `action`: `shutdown` | `reboot`

#### Response
```json
{
  "success": true,
  "message": "System will shutdown in 1 minute"
}
```
> **Note**: This command executes `shutdown -h +1` or `shutdown -r +1` on Linux/Mac, or `shutdown /s /t 5` on Windows.

### Application Control
Restart the Node.js application service (requires process manager like PM2).

- **Endpoint**: `POST /app/:action`
- **Permission**: Admin
- **Parameters**:
  - `action`: `restart`

#### Response
```json
{
  "success": true,
  "message": "Application server restarting..."
}
```

---

## 3. Docker Management

### Container Control
Start, stop, or restart specific Docker containers.

- **Endpoint**: `POST /docker/:id/:action`
- **Permission**: Admin
- **Parameters**:
  - `id`: Container ID or Name
  - `action`: `start` | `stop` | `restart`

#### Response
```json
{
  "success": true,
  "message": "Container started successfully"
}
```

#### Error Response
```json
{
  "error": true,
  "message": "Failed to start container: No such container: invalid-id"
}
```
