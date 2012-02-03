function Byte(){
	
}
Byte.prototype={
	bits: 0,
	ptr: 0,
	complete: function(){
		return this.ptr==8;
	},
	substr: function(start, length){
		var mask = this.bits & (0xff>>start);
		if(length) mask >>= 8-start-length;
		return mask;
	},
	fromBits: function(bits){
		//fromByteCodeを使うべき
		return this.fromByteCode(BitStream.bits2num(bits), bits.length);
	},
	toByteCode: function(){
		return this.bits;
	},
	fromByteCode: function(byteCode, length){
		var formerlen, latterlen, add, ret;
		if(this.ptr+length>8){
			formerlen = 8-this.ptr;
			latterlen = length-formerlen;
			add = byteCode>>latterlen
			ret = BitStream.num2bits(byteCode & (0xff >> 8-latterlen), latterlen);
		}else{
			formerlen = length;
			add = byteCode << 8-(this.ptr+length);
			ret = [];
		}
		this.bits |= add;
		this.ptr+=formerlen;
		return ret;
	},
	toBitsString: function(){
		return ("00000000"+this.bits.toString(2)).slice(-8);
	},
	getBit: function(ptr){
		return this.bits & (128>>ptr) ? 1 : 0;
	},
	fill: function(){
		this.ptr=8;
	}
};

function BitStream(){
	this.bytes=[];
}
BitStream.bits2num = function(bits){
	var ret=0;
	bits.forEach(function(bit){
		ret<<=1;
		ret|=bit?1:0;
	});
	return ret;
};
BitStream.num2bits = function(num, keta){
	//なるべく非推奨
	var ret=[];
	for(var i=0; i<keta; i++){
		ret.unshift(num%2);
		num>>=1;
	}
	return ret;
};
BitStream.concat = function(num1, num2, keta2){
	//なるべく非推奨
	return (num1<<keta2)+num2;
};
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
		return this.bytes.length==0 || this.bytes[this.bytes.length-1].complete();
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
	get: function(bytes, offset, length){
		var formerlen, latterlen;
		if(offset+length>8){
			formerlen = 8-offset;
			latterlen = length-(8-offset);
		}else{
			formerlen = length;
			latterlen = 0;
		}
		var bits = this.bytes[bytes].substr(offset, formerlen);
		if(latterlen==0){
			return bits;
		}else{
			return BitStream.concat(bits, this.bytes[bytes+1].substr(0, latterlen), latterlen);
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
			str+=this.base64String[this.get(ptr, 0, 6)];
			var bits=this.get(ptr, 6, 2);
			ptr++;
			if(ptr>=len){
				str+=this.base64String[BitStream.concat(bits, 0, 4)]+"==";
				break;
			}
			str+=this.base64String[BitStream.concat(bits, this.get(ptr, 0, 4), 4)];
			bits=this.get(ptr, 4, 4);
			ptr++;
			if(ptr>=len){
				str+=this.base64String[BitStream.concat(bits, 0, 2)]+"=";
				break;
			}
			str+=this.base64String[BitStream.concat(bits, this.get(ptr, 0, 2), 2)];
			str+=this.base64String[this.get(ptr, 2, 6)];
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
		if(!ret || ret.length==0) return;
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
