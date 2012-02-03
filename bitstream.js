function Byte(){
	
}
Byte.prototype={
	bits: 0,
	ptr: 0,
	filled: function(){
		return this.ptr==8;
	},
	substr: function(start, length){
		var mask = this.bits & (0xff>>start);
		if(length) mask >>= 8-start-length;
		return mask;
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
			ret ={byteCode: byteCode & (0xff >> 8-latterlen), len: latterlen};
		}else{
			formerlen = length;
			add = byteCode << 8-(this.ptr+length);
			ret = {byteCode: 0, len: 0};
		}
		this.bits |= add;
		this.ptr+=formerlen;
		return ret;
	},
	toBitsString: function(){
		return ("00000000"+this.bits.toString(2)).slice(-8);
	},
	toString: function(){
		return String.fromCharCode(this.toByteCode());
	},
	toHex: function(){
		return ("0"+this.toByteCode().toString(16)).slice(-2);
	},
	fromHex: function(hexString){
		if(hexString.length==1){
			return this.fromByteCode(parseInt(hexString, 16), 4);
		}else{
			return this.fromByteCode(parseInt(hexString, 16), 8);
		}
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
BitStream.concat = function(num1, num2, keta2){
	return (num1<<keta2)+num2;
};
BitStream.base64String = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
BitStream.prototype={
	bytes: [],
	ptrByte: 0,
	ptrBit: 0,
	fill: function(){
		if(this.bytes.length==0)return;
		this.bytes[this.bytes.length-1].fill();
	},
	getByte: function(num){
		this.bytes[num].getByteCode();
	},
	checkBorder: function(){
		return this.bytes.length==0 || this.bytes[this.bytes.length-1].filled();
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
	toString: function(){
		this.fill();
		return this.bytes.map(function(byte){
			return byte.toString();
		}).join("");
	},
	toBitsString: function(){
		this.fill();
		return this.bytes.map(function(byte){
			return byte.toBitsString();
		}).join("");
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
			str+=BitStream.base64String[this.get(ptr, 0, 6)];
			var bits=this.get(ptr, 6, 2);
			ptr++;
			if(ptr>=len){
				str+=BitStream.base64String[BitStream.concat(bits, 0, 4)]+"==";
				break;
			}
			str+=BitStream.base64String[BitStream.concat(bits, this.get(ptr, 0, 4), 4)];
			bits=this.get(ptr, 4, 4);
			ptr++;
			if(ptr>=len){
				str+=BitStream.base64String[BitStream.concat(bits, 0, 2)]+"=";
				break;
			}
			str+=BitStream.base64String[BitStream.concat(bits, this.get(ptr, 0, 2), 2)];
			str+=BitStream.base64String[this.get(ptr, 2, 6)];
			ptr++;
		}
		return str;
	},
	toHex: function(){
		this.fill();
		return this.bytes.map(function(byte){
			return byte.toHex();
		}).join("");
	},
	fromHex: function(hexString, add){
		if(!add) this.clear();
		var str, i=0;
		while(str=hexString.substr(i, 2)){
			this.fromByteCode(parseInt(str, 16), str.length*4);
			i+=2;
		}
		return this;
	},
	fromBase64: function(base64String, add){
		if(!add) this.clear();
		if(!this.checkBorder()) throw "オフセット境界エラー";
		var i=0;
		while(i<base64String.length){
			var strs=[];
			var mode;
			for(var j=0; j<4; j++){
				var str=base64String[i];
				if(str=="="){
					mode=j;
					break;
				}
				var num=BitStream.base64String.indexOf(str);
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
		if(this.bytes.length==0) this.bytes.push(new Byte());
		var ret=this.bytes[this.bytes.length-1].fromByteCode(byteCode, bits);
		if(ret.len==0) return;
		var byte = new Byte();
		byte.fromByteCode(ret.byteCode, ret.len);
		this.bytes.push(byte);
		return this;
	},
	fromBit: function(bit){
		return this.fromByteCode(bit, 1);
	},
	fromBitsString: function(bitsString){
		while(1){
			if(bitsString.length<=8){
				this.fromByteCode(parseInt(bitsString, 2), bitsString.length);
				break;
			}
			this.fromByteCode(parseInt(bitsString.substr(0,8), 2), 8);
			bitsString = bitsString.substr(8);
		}
		return this;
	},
	clear: function(){
		this.bytes=[];
		return this;
	}
};