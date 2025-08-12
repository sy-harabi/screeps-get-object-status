# screeps-get-object-status

## Purpose

In Screeps, some areas like novice or respawn zones are protected by impassable walls, especially in highway rooms. Objects like power banks or commodity deposits can sometimes appear in these highway rooms, but on the inaccessible side of these walls. This module helps you determine if a game object is located within one of these protected, inaccessible areas.

This prevents your bots from wasting time and resources trying to reach objects that are technically visible in a room but are actually behind an impassable barrier.

## How to Use

This module provides a single function, `getObjectStatus`, which takes a `RoomObject` or `RoomPosition` as input and returns the status of the area it's in.

```javascript
const getObjectStatus = require("./get-object-status")

// Example: Check the status of a PowerBank
const powerBank = Game.getObjectById("somePowerBankId") // Replace with actual PowerBank ID

if (powerBank) {
  try {
    const status = getObjectStatus(powerBank)
    console.log(`PowerBank status: ${status}`)

    if (status === "novice" || status === "respawn") {
      console.log("This PowerBank is in a protected area and likely inaccessible.")
    } else {
      console.log("This PowerBank is in a normal area and should be accessible.")
    }
  } catch (e) {
    console.log(`Error checking PowerBank status: ${e.message}`)
  }
}

// Example: Check the status of a specific RoomPosition
const position = new RoomPosition(25, 25, "W10N10") // Replace with your desired room and coordinates

try {
  const status = getObjectStatus(position)
  console.log(`Position status: ${status}`)
} catch (e) {
  console.log(`Error checking position status: ${e.message}`)
}
```

### Return Values

The `getObjectStatus` function returns one of the following strings:

- `"normal"`: The object is in a regular, accessible room or area.
- `"novice"`: The object is within a novice protected area.
- `"respawn"`: The object is within a respawn protected area.

### Errors

The function may throw an error if:

- The input `object` is invalid.
- Your bot does not have vision in the room where the object is located.
- The status cannot be determined for other reasons (e.g., incomplete pathfinding).
