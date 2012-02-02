function Byte(){
	this.bits=[];
}
Byte.prototype={
	bits: [],
	substr: function(start, length){
		if(length){
			return this.bits.slice(start, start+length);
		}else{
			return this.bits.slice(start);
		}
	},
	fromBits: function(bits){
//		console.log("bits",bits);
		this.bits=this.bits.concat(bits);
		if(this.bits.length>8){
			return this.bits.splice(8);
		}
	},
	toByteCode: function(){
		var num=0;
		for(var i=0; i<8; i++){
			num*=2;
			num+=this.bits[i]?1:0
		}
		return num;
	},
	fromByteCode: function(byteCode, length){
//		console.log("bytecode",byteCode, length);
		var bits=[];
		for(var i=0; i<length; i++){
			bits.unshift((byteCode>>i)%2);
		}
		return this.fromBits(bits);
	},
	toBitsString: function(){
		return this.bits.map(function(code){return code?"1":"0"}).join("");
	},
	getBit: function(ptr){
		return this.bits[ptr];
	},
	fill: function(){
		while(this.bits.length<8){
			this.bits.push(false);
		}
	}
};

function BitStream(){
	this.bytes=[];
}
BitStream.prototype={
	bytes: [],
	ptrByte: 0,
	ptrBit: 0,
	base64String: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",
	hexString: "0123456789ABCDEF",
	fill: function(){
		if(this.bytes.length==0)return;
		this.bytes[this.bytes.length-1].fill();
	},
	getByte: function(num){
		this.bytes[num].getByteCode();
	},
	checkBorder: function(){
		return this.bytes.length==0 || this.bytes[this.bytes.length-1].bits.length==8;
	},
	rewind: function(){
		this.ptrByte = this.ptrBit = 0;
	},
	readBit: function(){
		var ret = this.bytes[this.ptrByte].getBit(this.ptrBit);
		if(++this.ptrBit==8){
			this.ptrBit=0;
			this.ptrByte++;
		}
		return ret;
	},
	bits2num: function(bits){
//		console.log(bits.join(""));
		var num=0;
		bits.forEach(function(bit){
			num*=2;
			num+=bit?1:0;
		});
		return num;
	},
	get: function(bytes, offset, length){
		var bits = this.bytes[bytes].substr(offset, length);
		if(length==bits.length){
			return bits;
		}else{
			if(!this.bytes[bytes+1]){
				return bits;
			}else{
				return bits.concat(this.bytes[bytes+1].substr(0, length-bits.length));
			}
		}
	},
/*	forEach: function(bits, callback){
		while(1){
			callback();
		}
	},*/
	toString: function(){
		this.fill();
		var len=this.bytes.length, str="";
		for(var i=0; i<len; i++){
			str+=String.fromCharCode(this.bytes[i].toByteCode());
		}
		return str;
	},
	toBitsString: function(){
		this.fill();
		return this.bytes.map(function(byte){return byte.toBitsString()}).join("");
	},
	toBase64: function(){
		//000000|11
		//1111|0000
		//00|111111
		var ptr=0, len=this.bytes.length;
		this.fill();
		var str="";
		while(1){
			if(ptr>=len) break;
			str+=this.base64String[this.bits2num(this.get(ptr, 0, 6))];
			var bits=this.get(ptr, 6, 2);
			ptr++;
			if(ptr>=len){
				str+=this.base64String[this.bits2num(bits.concat([0,0,0,0]))]+"==";
				break;
			}
			str+=this.base64String[this.bits2num(bits.concat(this.get(ptr, 0, 4)))];
			bits=this.get(ptr, 4, 4);
			ptr++;
			if(ptr>=len){
				str+=this.base64String[this.bits2num(bits.concat([0,0]))]+"=";
				break;
			}
			str+=this.base64String[this.bits2num(bits.concat(this.get(ptr, 0, 2)))];
			str+=this.base64String[this.bits2num(this.get(ptr, 2, 6))];
			ptr++;
		}
		return str;
	},
	toHex: function(){
		this.fill();
		var len=this.bytes.length;
		var str="";
		for(var i=0; i<len; i++){
			var byteCode = this.bytes[i].toByteCode();
			str+=this.hexString[byteCode>>4];
			str+=this.hexString[byteCode%(1<<4)];
		}
		return str;
	},
	fromHex: function(hexString, add){
		if(!add) this.clear();
		hexString=hexString.toUpperCase();
		for(var i=0; i<hexString.length; i++){
			var key=this.hexString.indexOf(hexString[i]);
			if(key==-1) throw "Illegal char "+hexString[i];
			this.fromByteCode(key, 4);
		}
		return this;
	},
	fromBase64: function(base64String, add){
		if(!add) this.clear();
		if(!this.checkBorder()) throw "オフセット境界エラー";
		var i=0;
		while(i<base64String.length){
			var strs=[]
			var mode;
			for(var j=0; j<4; j++){
				var str=base64String[i];
				if(str=="="){
					mode=j;
					break;
				}
				var num=this.base64String.indexOf(str);
				if(num==-1) throw "Illegal char "+base64String[i];
				strs.push(num);
				i++;
			}
			if(mode==2){
				//AA== X
				this.fromByteCode(strs[0], 6);
				this.fromByteCode(strs[1]>>4, 2);
				break;
			}else if(mode==3){
				//AAA= XX
				this.fromByteCode(strs[0], 6);
				this.fromByteCode(strs[1], 6);
				this.fromByteCode(strs[2]>>2, 4);
				break;
			}else{
				//AAAA XXX
				this.fromByteCode(strs[0], 6);
				this.fromByteCode(strs[1], 6);
				this.fromByteCode(strs[2], 6);
				this.fromByteCode(strs[3], 6);
			}
		}
		return this;
	},
	fromCharCode: function(charCode){
		if(!this.checkBorder()) throw "オフセット境界エラー";
		var byte = new Byte();
		byte.fromByteCode(charCode, 8);
		this.bytes.push(byte);
		return this;
	},
	fromString: function(bytes, add){
		if(!add) this.clear();
		if(!this.checkBorder()) throw "オフセット境界エラー";
		for(var i=0; i<bytes.length; i++){
			this.fromCharCode(bytes.charCodeAt(i));
		}
		return this;
	},
	fromByteCode: function(byteCode, bits){
		if(bits>8) throw "バイトコードが8桁を超えています";
//		console.log(this.bytes.map(function(obj){return obj.toByteCode()}).join(","), byteCode, bits);
		if(this.bytes.length==0) this.bytes.push(new Byte());
		var ret=this.bytes[this.bytes.length-1].fromByteCode(byteCode, bits);
		if(!ret) return;
		var byte = new Byte();
		byte.fromBits(ret);
		this.bytes.push(byte);
		return this;
	},
	fromBit: function(bit){
		return this.fromBits([bit]);
	},
	fromBits: function(bits){
		if(this.bytes.length==0) this.bytes.push(new Byte());
		while(1){
			bits = this.bytes[this.bytes.length-1].fromBits(bits);
			if(!bits) break;
			this.bytes.push(new Byte());
		}
		return this;
	},
	fromBitsString: function(bitsString){
		return this.fromBits(bitsString.split("").map(function(code){return code=="1"?true:false;}));
	},
	clear: function(){
		this.bytes=[];
		return this;
	}
};
