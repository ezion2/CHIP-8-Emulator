/*
    *   0x000-0x1FF - Chip 8 interpreter (contains font set in emu)
    *   0x050-0x0A0 - Used for the built in 4x5 pixel font set (0-F)
    *   0x200-0xFFF - Program ROM and work RAM
*/
/*
	*   4kB of 8-bit memory<br/>
	*   At position 0x50: The "bios" fontset
	*   At position 0x200: The start of every program
*/
// Creating left padding depending on how long string is, to make an 8 bit number.
// EX: x = 25
// x.toString(2) = 11001; x.toString(2).length = 5
// take the padding: pad = "00000000" (8 zeroes)
// get the needed amount of 0's to pad 25 into a 8 bit number
// pad.substring(0, pad.length - x.toString(2).length) = "000" 8 - 5 = 3, we need 3 zeroes
// pad.substring(0, pad.length - x.toString(2).length) + x.toString(2) = "00011001"
const font = [
    0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
    0x20, 0x60, 0x20, 0x20, 0x70, // 1
    0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
    0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
    0x90, 0x90, 0xF0, 0x10, 0x10, // 4
    0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
    0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
    0xF0, 0x10, 0x20, 0x40, 0x40, // 7
    0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
    0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
    0xF0, 0x90, 0xF0, 0x90, 0x90, // A
    0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
    0xF0, 0x80, 0x80, 0x80, 0xF0, // C
    0xE0, 0x90, 0x90, 0x90, 0xE0, // D
    0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
    0xF0, 0x80, 0xF0, 0x80, 0x80  // F
];

const leftPad = (string, pad) => pad.substring(0, pad.length - string.toString(2).length) + string.toString(2);

let steps = 10;

let Chip = function()
{
    this.c = document.getElementById("canvas");
    this.layout = {};
    this.reset();
    this.animationFrameRequest = null;
    this.initKeypad();

};

Chip.prototype =
{
    reset: function()
    {
        this.stack = new Uint16Array(16);
        this.stackpointer = 0;
    
        this.color = 'red';
        
        this.opcode = null;

        this.memory = new Uint8Array(4096); // 4 KiB = 4096, This is our ram
        this.V = new Uint8Array(16); // V-Registers (V0-VF) or V0 - V15, 8 bit
        this.keys = new Uint8Array(16); // Is a hex based keypad from 0 - 15 (0x0 - 0xF)
        this.display = new Uint8Array(64 * 32);
    
        this.I = 0x0; // 16-Bit Wide, but only 12 bits will be used, this is the address register, stores the address
        
        this.delay_timer = 0; // Delay timer
        this.sound_timer = 0; // Sound timer
        this.pc = 0x200; // Program counter
        this.needAnimation = false;
        
        this.keyPress = new Map();
        this.keyWait = false;
        window.cancelAnimationFrame(this.animationFrameRequest)

        this.clearScreen();
        this.loadFontset();
    },

    loadFontset: function()
    {        
        for(let i = 0; i < font.length; i++)
        {
            this.memory[0x50 + i] = font[i] & 0xFF;
        }
    },

    loop: function()
    {
        if(!this.keyWait)
        {
            this.readOpcode();
        }
        this.cycle();

        if(steps-- == 0 || this.needAnimation)
        {
            steps = 10;
            this.needAnimation = false;
            this.animationFrameRequest = window.requestAnimationFrame(this.loop.bind(this));

        }
        else
        {
            this.loop();
        }
    },

    readOpcode: function()
    {
        this.opcode = (this.memory[this.pc] << 8) | this.memory[this.pc + 1];
    },

    cycle: function()
    {
        // Opcode is 16-bit, Memory is 8-bit, so we will merge two memory slots into 1 opcode
        // 8-Bit Hex Character: 0xAB 
        // 16-Bit Hex Character: 0xABCD
        // Fetch Opcode
        // Decode Opcode
        // Execute Opcode during decode
        
        let x = (this.opcode & 0x0F00) >> 8;
        let y = (this.opcode & 0x00F0) >> 4;
        let n = (this.opcode & 0x000F);
        let nn = (this.opcode & 0x00FF);
        let nnn = (this.opcode & 0x0FFF);

        console.log(this.opcode.toString(16).toUpperCase() + ": ");

        switch(this.opcode & 0xF000)
        {
			case 0x0000:
				switch(this.opcode & 0x00FF)
				{
					case 0x00E0:
                        this.clearScreen();
                        this.pc += 2;
						break;
						
					case 0x00EE:
						this.stackpointer--;
						this.pc = this.stack[this.stackpointer] + 2;
						console.log("Returning to: " + this.pc.toString(16).toUpperCase());
                        break;

                    default:
                        console.log("Unsupported Opcode: " + this.opcode.toString(16).toUpperCase());
                        break;
				}
            break;
            

            // 1NNN: goto NNN; Jumps to address NNN
            // Since we are jumping, we don't need to set it in stack.
            case 0x1000:
                this.pc = nnn;                           // Jumping to new address
                console.log("Jumping to " + this.pc.toString(16).toUpperCase());
                break;
            
			
            // Calls Subroutine at NNN
            // Store current position, jump to new one, jump back to old posistion
            case 0x2000:
                console.log("Current Address: " + this.opcode.toString(16).toUpperCase());
                this.stack[this.stackpointer] = this.pc;          // Setting current address in stack
                this.stackpointer++;                    // Increment stack pointer
                this.pc = nnn;            // Jumping to new address
                console.log("Jumping To Address: " + this.pc.toString(16).toUpperCase());
                console.log("Calling " + this.pc.toString(16).toUpperCase() + " from " + (this.stack[this.stackpointer - 1]).toString(16).toUpperCase());
                break;
			
				
				
			// 3XNN: if(Vx==NN); Skips the next instruction if VX equals NN. (Usually the next instruction is a jump to skip a code block)
            // We are not performing a jump, just simplying check if VX == NN, if so we increase by 4, to skip, since each instruction is 2 bytes
           	// If we increase by 4, we skip both the current and next instruction.	
			case 0x3000:
				if(this.V[x] == nn)
				{
					this.pc += 4;
					console.log("Skipping next instruction (V[" + x +"] == " + nn + ")");
				}
				else
				{
					this.pc += 2;
					console.log("Not skipping next instruction (V[" + x +"] != " + nn + ")");
					
                }
                break;
                
			// 4XNN: If(VX != NN); Skips the Next instruction if VX doesn't equal NN.
			case 0x4000:					
				if(this.V[x] != nn)
				{
					console.log("Skipping instruction!");
					this.pc += 4;
				}
				else
				{
					this.pc += 2;
				}
				break;				

            // 5XY0
            //if(Vx!=Vy)
            // Skips the next instruction if VX equals VY. (Usually the next instruction is a jump to skip a code block)
            case 0x5000:
                if(this.V[x] == this.V[y])
                {
                    this.pc += 4;
                }
                else
                {
                    this.pc += 2;
                }
                break;
            
            case 0x6000: // 6XNN: Vx = NN; Sets VX to NN, X being the index in the second Part
                this.V[x] = nn;
                this.pc += 2;
                console.log("Setting V[" + x + "] to " + this.V[x]);
                break;
				
			case 0x7000: // 7XNN: Vx = NN; Adds NN to VX
				this.V[x] = (this.V[x] + nn) & 0xFF;
				
				this.pc +=2;
				console.log("Adding " + nn + " to V["+ x + "] = " + this.V[x]);
                break;
            
            case 0x8000:
				switch(this.opcode & 0x000F)
				{
					// 8XY0: VX = VY; Sets VX to the value of VY
					case 0x0000:
                        this.V[x] = this.V[y];	
						this.pc += 2;
						break;
						
                    case 0x0001:
                        // Set Vx = Vx OR Vy.
                        this.V[x] = this.V[x] | this.V[y];
                        this.pc += 2;
                        break;

					// 8XY2: Vx = Vx & VY; Sets Vx to VX & VY
					case 0x0002:
                        this.V[x] = this.V[x] & this.V[y];
                        this.pc += 2;	
                        break;

                    case 0x0003:
                        // Set Vx = Vx XOR Vy.
                        this.V[x] = this.V[x] ^ this.V[y];
                        this.pc += 2;
                        break;
                        
					// 8XY4: VX = VX + VY; Check if carry and set VF to 1, else 0
					// If VX + VY > 255 - Set Flag
					// Or if VY > 255 - VX
					// borrow flag, 
					// setting it if a<b when computing a−b, and a borrow must be performed. If a≥b, 
					
					case 0x0004:
						if(this.V[y] > (0xFF - this.V[x]))
						{
							console.log("Carry Flag Set: " + 1);
							this.V[0xF] = 1;
						}
						else
						{
							console.log("Carry Flag Set: " + 0);
							this.V[0xF] = 0;
						}
						this.V[x] = (this.V[x] + this.V[y]) & 0xFF; // So it does not exceed byte size?	
                        this.pc += 2;
						break;
					
					// 8XY5: VX = VX - VY
					// VY is subtracted from VX, VF set to 0 when there is borrow
					// 1 When there isn't
					// If the number is negative, there is a borrow
					// So if VY is larger than VX, then its gonna be negative so we borrow, else set to 1
					case 0x0005:
						let s = this.V[x] - this.V[y];
							
						console.log("V[x]: " + this.V[x].toString(16).toUpperCase());
						console.log("V[y]: " + this.V[y].toString(16).toUpperCase());
						console.log("V[x] - V[y]: " + s.toString(16).toUpperCase());
							
						if(this.V[y] > this.V[x])
						{
							console.log("Borrow set!");
							this.V[0xF] = 0;
						}
						else
						{
							this.V[0xF] = 1;
						}
						this.V[x] = (this.V[x] - this.V[y]) & 0xFF; // So it does not exceed byte size?
						this.pc += 2;
						break;
					
					case 0x0006:
						this.V[0xF] = this.V[x] & 1
						this.V[x] = this.V[x] >> 1;
						this.pc += 2;
                        break;
                    
                // 8xy7 - SUBN Vx, Vy
				// Set Vx = Vy - Vx, set VF = 1(no borrow).
                    case 0x0007:
                        this.V[x] = this.V[y] - this.V[x];
                        this.V[0xF] = 1;
                        if(this.V[x] < 0)
                        {
                            this.V[0xF] = 0;
                            this.V[x] += 0xFF;
                        }
                        this.pc += 2;
                        break;

                    case 0x000E:
                        let sig_b = parseInt(this.m_significant(leftPad(this.V[x], "00000000")).join(''))
                        this.V[0xF] = parseInt(sig_b, 2)
                        this.V[x] = this.V[x] << 1;
                        this.pc += 2;
						break;
				}
			break;
            
            // 9XY0: if(Vx==Vy); Skips the next instruction if VX doesn't equal VY. (Usually the next instruction is a jump to skip a code block)
            case 0x9000:
                if(this.V[x] == this.V[y])
                {
                    this.pc += 2;
                }
                else
                {
                    this.pc += 4;
                }
            

            case 0xA000:
                this.I = nnn;
                console.log("Set I to: " + this.I.toString(16).toUpperCase());
                this.pc += 2;
                break;

            // BNNN
            // PC=V0+NNN
            // Jumps to the address NNN plus V0.
            case 0xB000:
                this.pc = this.V[0x0] + nnn;
                break;

            case 0xC000:
                let randomNumber = Math.floor(Math.random() * 256);
                this.V[x] = randomNumber & nn;
                console.log("V[" + x + "] has been set to (randomised) " + (randomNumber % nn));
                this.pc += 2;
                break;

            
            // DXYN: 
            // draw(Vx,Vy,N);
            // Sprite X & Y coordinates, N = height 
            case 0xD000:
            this.V[0xF] = 0;

            // Height of n bits
            for(let row = 0; row < n; row++) // Y
            {
                let line = leftPad(this.memory[this.I + row], "00000000"); // Fetching Pixel value and padding to make 8 bit wide

                let y_coordinate = (this.V[y] + row) % 32; // Wrap Around; Setting y coordinate

                for(let row_bits = 0; row_bits < 8; row_bits++) // X
                {
                    let x_coordinate = (this.V[x] + row_bits) % 64; // setting x coordinate
                    
                    // Xor existing and bit
                    // Using the Y & X coordinate, find pixel on screen then, xor
                    let pixel = this.screen[y_coordinate][x_coordinate] ^ line[row_bits];

                    // Unset pixel? flag
                    //let s = this.screen[y_coordinate][x_coordinate] & line[row_bits];
                    //console.log("ANDING: " + s);
                    if (this.screen[y_coordinate][x_coordinate] & line[row_bits]) // checking if bit is set to 1 for collision
                    {
                        // set flag
                        this.V[0xF] = 1;
                    }
                    // update screen
                    this.screen[y_coordinate][x_coordinate] = pixel; // setting pixel at these cooridnates
                    this.updatePix(x_coordinate, y_coordinate, pixel) // at x y coordinates, and pixel value
                }
            }
            this.pc += 2;
            console.log("Drawing at V[" + ((this.opcode.toString(16).toUpperCase() & 0x0F00) >> 8) + "] = " + x + ", V[" + ((this.opcode.toString(16).toUpperCase() & 0x00F0) >> 4) + "] = " + y);
            break;
            
            case 0xE000:
                switch(this.opcode & 0x00FF)
                {
                    //EX9E Skip the next instruction if the Key, VX, is pressed
                    case 0x009E:
                    // this.V[x] being the key
                        if(this.keyPress.has(this.V[x])) 
                        {
                            this.needAnimation = true;
                            this.pc += 4;
                        } 
                        else 
                        {
                            this.pc += 2;
                        }
                        console.log("Skipping next instruction if V[" + this.V[x] + "] is pressed");
                        console.log("Skipping next instruction if keys[" + this.keys[this.V[x]] + "] is pressed");
                        break;
                    

                    //EXA1 Skip the next instruction if the Key VX is NOT pressed    
                    case 0x00A1:
                        if(!this.keyPress.has(this.V[x]))
                        {
                            this.pc += 4;
                        }
                        else 
                        {
                            this.pc += 2;
                        }
                        console.log("Skipping next instruction if V[" + this.V[x] + "] is NOT pressed");
                        console.log("Skipping next instruction if keys[" + this.keys[this.V[x]] + "] is NOT pressed");
                        break;
                }
                break;

			case 0xF000:
				switch(this.opcode & 0x00FF)
				{
                    // FX07: Vx = get_delay(); Sets VX to the value of the delay timer.
                    case 0x0007:
                        this.V[x] = this.delay_timer;
                        console.log("V[" + x + "] has been set to " + this.delay_timer);
						this.pc += 2;
                        break;	
                    
                    // FX0A: Vx = get_key()
                    // A key press is awaited, and then stored in Vx. (Blocking operation. all instruction halted until next key event.)    
                    case 0x000A:
                        if(this.keyPress.size == 0)
                        {
                            this.keyWait = true;
                            break;
                        }
                        else
                        {
                            this.keyWait = false;
                        }
                        this.V[x] = this.keyPress.keys().next().value;
                        this.pc += 2;
                        break;
						
					// FX15: delay_timer(Vx); Sets the delay timer to VX.
                    case 0x0015: 
                        this.delay_timer = this.V[x];
                        console.log("Set delay_timer to V[" + x + "] = " + this.V[x]);
						this.pc += 2;
                        break;
                        
                        

                    // FX18: delay_timer(VX); Sets delay timer to VX
					case 0x0018:
                        this.delay_timer = this.V[x];

                        this.pc += 2;
                        break; 

                    // FX1E: I += Vx
                    // Adds VX to I
                    case 0x001E:
                        this.I = this.V[x] + this.I;
                        this.pc += 2;
                        break;
                    
                    // FX29: I = sprite_address[VX];
                    // Sets I to the location of the sprite for the character in VX
                    case 0x0029:
                        let character = this.V[x];
                        this.I = 0x050 + (character * 5);

                        console.log("Setting I to Character V[" + x + "] = " + this.V[x] + " Offset to 0x" + this.I.toString(16).toUpperCase());
                        this.pc += 2;
                        break;
						
					 // FX33: Store a binary-coded decimal value VX in I, I + 1, I + 2
                    /*
                        Stores the binary-coded decimal representation of VX, 
                        with the most significant of three digits at the address in I, 
                        the middle digit at I plus 1, 
                        and the least significant digit at I plus 2.

                        (In other words, take the decimal representation of VX, 
                        place the hundreds digit in memory at location in I, 
                        the tens digit at location I+1, 
                        and the ones digit at location I+2.)
                    */
						

					case 0x0033:
						let value = this.V[x];
						let hundreds = (value - (value % 100)) / 100;
						value -= hundreds * 100;
						let tens = (value - (value % 10)) /10;
						value -= tens * 10
						
						this.memory[this.I] = hundreds;
						this.memory[this.I + 1] = tens;
						this.memory[this.I + 2] = value;
						
						console.log("Storing Binary-Coded Decimal V[" + x + "] = " + this.V[(this.opcode.toString(16) & 0x0F00) >> 8] + " as { " + hundreds+ ", " + tens + ", " + value + "}");
						this.pc += 2;
                        break;
                        
                    // Fx55 - LD [I], Vx
                    // Store registers V0 through Vx in memory starting at location I.                    
                    case 0x0055:
                        for (let i = 0; i <= x; i++) 
                        {
                            this.memory[this.I + i] = this.V[i];
                        }
                        this.pc += 2;
                        break;

						
					// FX65: Fills V0 to VX with values from I	
					case 0x0065:
						for(let i = 0; i <= x; i++)
						{
							this.V[i] = this.memory[this.I + i];
						}
						
						console.log("Setting V[0] to V[" + x + "] to the values of memory[0x" + (this.I & 0xFFFF).toString(16).toUpperCase() + "]");
                        this.I = this.I + x + 1; // IDK if this is correct
                        this.pc += 2;
                        break;	
                }
                
            default:
                console.log("Unsupported Opcode: " + this.opcode.toString(16).toUpperCase());
                break;
        }

        if(this.sound_timer > 0)
        {
            this.sound_timer--;
        }

        if(this.delay_timer > 0)
        {
            this.delay_timer--;
        }
    },

    loadProgram: function(program)
    {
        this.reset();
        for(i = 0; i < program.length; i++)
        {
            this.memory[0x200 + i] = program[i]; // double check this later
        }
        this.loop();
    },

    initScreen: function() {
        // 64 x 32
        // (64,32)
        // (x,y)
        // Creating 32 wide array, filled with undefined
        this.screen = Array(32).fill();// 32 Vertically
        // Replacing with 64 wide arrays on each row
        this.screen.forEach((row, idx) => this.screen[idx] = Array(64)); // 64 horizontal
    },

    clearScreen: function() {
        this.initScreen();
        this.c.innerHTML = "";
        this.createPix();
    },

    createPix: function()
    {
        for(let i = 0; i < 2048; i++) // Screen size is 64 * 32
        {
            let div = document.createElement("div");
            div.id = `pixel-${i}`;
            this.c.appendChild(div);
        }
    },

    updatePix: function(x, y, value)
    {
        let id = (y * 64) + x;
        let pixel = this.c.querySelector(`#pixel-${id}`);
        if(value == 0)
        {
            pixel.classList.remove('white');
            pixel.classList.add('black');
        }
        else
        {
            pixel.classList.remove('black');
            pixel.classList.add('white');
        }
    },

    initKeypad: function()
    {
        this.layout = {
			'x': {value: 0x0, position: 13 },
			'1': {value: 0x1, position: 0 },
			'2': {value: 0x2, position: 1 },
			'3': {value: 0x3, position: 2 },
			'q': {value: 0x4, position: 4 },
			'w': {value: 0x5, position: 5 },
			'e': {value: 0x6, position: 6 },
			'a': {value: 0x7, position: 8 },
			's': {value: 0x8, position: 9 },
			'd': {value: 0x9, position: 10 },
			'z': {value: 0xA, position: 12 },
			'c': {value: 0xB, position: 14 },
			'4': {value: 0xC, position: 3 },
			'r': {value: 0xD, position: 7 },
			'f': {value: 0xE, position: 11 },
			'v': {value: 0xF, position: 15 }
        };

        this.keys = document.querySelectorAll(".input");

        window.document.body.addEventListener('keydown', (event) =>
        {
            let key = this.layout[event.key];
            if(!key)
            {
                return;
            }
            this.keyPress.set(key.value, true);
            document.querySelector(`#key_${event.key}`).classList.add("key-pressed");
        });

        window.document.body.addEventListener('keyup', event => {
			let key = this.layout[event.key];
			if (!key) {
				return;
			}
			this.keyPress.delete(key.value);
			this.needAnimation = true;
			document.querySelector(`#key_${event.key}`).classList.remove("key-pressed");
		});

    },

    m_significant: function(padded)
    {
        let x = Array(padded.length)
        let y = false;
        for (let i = 0; i < padded.length; i++)
        {
            if(y != true)
            {
                if(padded[i] == 1)
                {
                    sb = i;
                    y = true;
                    x[i] = 1;
                    //console.log("sb: " + sb);
                }
                else
                {
                    x[i] = 0;
                }
            }
            else
            {
                x[i] = 0;

            }
        }
        return x;
    }

};