
function buildChannelEncoder(readKlass, writeClass) {

  return function encodeChannel(chan) {
    // hack, let's just use 4 bytes
    var buf = new Buffer(5);
    if (chan instanceof readKlass) {
      // let's encode is as outbound
      buf[0] = 0x2;
    } else if (chan instanceof writeClass) {
      // let's encode is as inbound
      buf[0] = 0x1;
    }

    buf.writeUInt32BE(chan.id, 1);
    return buf;
  }
}

exports.buildChannelEncoder = buildChannelEncoder;
