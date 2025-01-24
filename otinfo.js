// Extended from https://github.com/danbovey/fontname
// Extended to access the GPOS and GSUB scriptTable and featureTable
// github.com/MattMatic 2025-01-24

(function(global, factory) {
  if (typeof define === "function" && define.amd) define(factory);
  else if (typeof module === "object") module.exports = factory();
  else global.OTInfo = factory();
})(this, function() {
  var OTInfo = {};

  OTInfo.parse = function(buff) {
    var bin = OTInfo._bin;
    var data = new Uint8Array(buff);
    var tag = bin.readASCII(data, 0, 4);

    // If the file is a TrueType Collection
    if (tag == "ttcf") {
      var offset = 8;
      var numF = bin.readUint(data, offset);
      offset += 4;
      var fnts = [];
      for (var i = 0; i < numF; i++) {
        var foff = bin.readUint(data, offset);
        offset += 4;
        fnts.push(OTInfo._readFont(data, foff));
      }
      return fnts;
    } else {
      return [OTInfo._readFont(data, 0)];
    }
  };

  OTInfo._readFont = function(data, offset) {
    var bin = OTInfo._bin;
    var tables = {};
    tables.scripts = new Set();
    tables.languages = new Set();
    tables.features = new Set();
    offset += 4;
    var numTables = bin.readUshort(data, offset);
    offset += 8;

    for (var i = 0; i < numTables; i++) {
      var tag = bin.readASCII(data, offset, 4);
      offset += 8;
      var toffset = bin.readUint(data, offset);
      offset += 8;
      if (tag === "name") {
        tables[tag] = OTInfo.name.parse(data, toffset);
      } else
      if (tag ==="GSUB") {
        tables[tag] = OTInfo.GSUBGPOS.parse(data, toffset, tables);
      } else
      if (tag === "GPOS") {
        tables[tag] = OTInfo.GSUBGPOS.parse(data, toffset, tables);
      } else {
        //console.log(tag);
      }
    }
    return tables;
    //throw new Error('Failed to parse file');
  };

  OTInfo._bin = {
    readUshort: function(buff, p) {
      return (buff[p] << 8) | buff[p + 1];
    },
    readUint: function(buff, p) {
      var a = OTInfo._bin.t.uint8;
      a[3] = buff[p];
      a[2] = buff[p + 1];
      a[1] = buff[p + 2];
      a[0] = buff[p + 3];
      return OTInfo._bin.t.uint32[0];
    },
    readTag: function(buff, p) {
      return OTInfo._bin.readASCII(buff, p, 4);
    },
    readUint64: function(buff, p) {
      return (
        OTInfo._bin.readUint(buff, p) * (0xffffffff + 1) +
        OTInfo._bin.readUint(buff, p + 4)
      );
    },
    /**
     * @param {number} l length in Characters (not Bytes)
     */
    readASCII: function(buff, p, l) {
      var s = "";
      for (var i = 0; i < l; i++) {
        s += String.fromCharCode(buff[p + i]);
      }
      return s;
    },
    readUnicode: function(buff, p, l) {
      var s = "";
      for (var i = 0; i < l; i++) {
        var c = (buff[p++] << 8) | buff[p++];
        s += String.fromCharCode(c);
      }
      return s;
    }
  };

  OTInfo._bin.t = { buff: new ArrayBuffer(8) };
  OTInfo._bin.t.int8 = new Int8Array(OTInfo._bin.t.buff);
  OTInfo._bin.t.uint8 = new Uint8Array(OTInfo._bin.t.buff);
  OTInfo._bin.t.int16 = new Int16Array(OTInfo._bin.t.buff);
  OTInfo._bin.t.uint16 = new Uint16Array(OTInfo._bin.t.buff);
  OTInfo._bin.t.int32 = new Int32Array(OTInfo._bin.t.buff);
  OTInfo._bin.t.uint32 = new Uint32Array(OTInfo._bin.t.buff);

  OTInfo.name = {};
  OTInfo.name.parse = function(data, offset) {
    var bin = OTInfo._bin;
    var obj = {};
    offset += 2;
    var count = bin.readUshort(data, offset);
    offset += 2;
    offset += 2;

    var names = [
      "copyright",
      "fontFamily",
      "fontSubfamily",
      "ID",
      "fullName",
      "version",
      "postScriptName",
      "trademark",
      "manufacturer",
      "designer",
      "description",
      "urlVendor",
      "urlDesigner",
      "licence",
      "licenceURL",
      "---",
      "typoFamilyName",
      "typoSubfamilyName",
      "compatibleFull",
      "sampleText",
      "postScriptCID",
      "wwsFamilyName",
      "wwsSubfamilyName",
      "lightPalette",
      "darkPalette",
      "preferredFamily",
      "preferredSubfamily",
    ];

    var offset0 = offset;

    for (var i = 0; i < count; i++) {
      var platformID = bin.readUshort(data, offset);
      offset += 2;
      var encodingID = bin.readUshort(data, offset);
      offset += 2;
      var languageID = bin.readUshort(data, offset);
      offset += 2;
      var nameID = bin.readUshort(data, offset);
      offset += 2;
      var slen = bin.readUshort(data, offset);
      offset += 2;
      var noffset = bin.readUshort(data, offset);
      offset += 2;

      var cname = names[nameID];
      var soff = offset0 + count * 12 + noffset;
      var str;
      if (platformID == 0) {
        str = bin.readUnicode(data, soff, slen / 2);
      } else if (platformID == 3 && encodingID == 0) {
        str = bin.readUnicode(data, soff, slen / 2);
      } else if (encodingID == 0) { 
        str = bin.readASCII(data, soff, slen);
      } else if (encodingID == 1) {
        str = bin.readUnicode(data, soff, slen / 2);
      } else if (encodingID == 3) {
        str = bin.readUnicode(data, soff, slen / 2);
      } else if (platformID == 1) {
        str = bin.readASCII(data, soff, slen);
        console.log("reading unknown MAC encoding " + encodingID + " as ASCII");
      } else {
        throw new Error("unknown encoding " + encodingID + ", platformID: " + platformID);
      }

      var tid = "p" + platformID + "," + languageID.toString(16);
      if (obj[tid] == null) {
        obj[tid] = {};
      }
      obj[tid][cname] = str;
      obj[tid]._lang = languageID;
    }

    for (var p in obj) {
      if (obj[p].postScriptName != null) {
        return obj[p];
      }
    }

    var tname;
    for (var p in obj) {
      tname = p;
      break;
    }
    console.log("returning name table with languageID " + obj[tname]._lang);
    return obj[tname];
  };


  OTInfo.GSUBGPOS = {};
  OTInfo.GSUBGPOS.parse = function(data, offset, tables) {
    var tableStart = offset;
    var bin = OTInfo._bin;
    var majorVersion = bin.readUshort(data, offset);
    offset += 2;
    var minorVersion = bin.readUshort(data, offset);
    offset += 2;
    var scriptListOffset = bin.readUshort(data, offset);
    offset += 2;
    var featureListOffset = bin.readUshort(data, offset);
    var result = {};
    result.scriptTable = OTInfo.scriptListTable.parse(data, tableStart + scriptListOffset, tables);
    result.featureListTable = OTInfo.featureListTable.parse(data, tableStart + featureListOffset, tables);
    return result;
  };

  OTInfo.scriptListTable = {};
  OTInfo.scriptListTable.parse = function(data, offset, tables) {
    var scriptListStart = offset;
    var bin = OTInfo._bin;
    var scriptCount = bin.readUshort(data, offset);
    scriptCount = Math.min(scriptCount, 256);
    offset += 2;
    var scriptList = {};
    while (scriptCount > 0) {
      var scriptTag = bin.readTag(data, offset);
      offset += 4;
      var scriptOffset = bin.readUshort(data, offset);
      offset += 2;
      //console.log('scriptTag', scriptTag);
      tables.scripts.add(scriptTag);
      scriptList[scriptTag] = OTInfo.scriptTable.parse(data, scriptListStart + scriptOffset, tables);
      scriptCount--;
    }
    return scriptList;
  };

  OTInfo.scriptTable = {};
  OTInfo.scriptTable.parse = function(data, offset, tables) {
    var bin = OTInfo._bin;
    var defaultLangSysOffset = bin.readUshort(data, offset);
    offset += 2;
    var langSysCount = bin.readUshort(data, offset);
    langSysCount = Math.min(langSysCount, 256);
    //console.log('scriptTable', defaultLangSysOffset, langSysCount);
    offset += 2;
    var langRecords = new Set();
    while (langSysCount > 0) {
      var langSysTag = bin.readTag(data, offset);
      offset += 4;
      var langSysOffset = bin.readUshort(data, offset);
      offset += 2;
      tables.languages.add(langSysTag);
      langRecords.add(langSysTag);
      langSysCount--;
    }
    return langRecords;
  };

  OTInfo.featureListTable = {};
  OTInfo.featureListTable.parse = function(data, offset, tables) {
    var bin = OTInfo._bin;
    var featureCount = bin.readUshort(data, offset);
    offset += 2;
    var featureRecords = new Set();
    while (featureCount > 0) {
      var featureTag = bin.readTag(data, offset);
      offset += 4;
      var featureOffset = bin.readUshort(data, offset);
      offset += 2;
      featureCount--;
      featureRecords.add(featureTag);
      tables.features.add(featureTag);
    }
    return featureRecords;
  };

  return OTInfo;
});
