def panic(_number_):
  return
def reset():
  return
def sleep(_milliseconds_):
  return
def running_time():
  return 0
def temperature():
  return 0
def set_volume(_level_):
  return

class __Button:
  def is_pressed(self):
    return True
  def was_pressed(self):
    return True
  def get_presses(self):
    return 0
button_a=__Button()
button_b=__Button()
 
class __PinDigitalW:
  def write_digital(self,_value):
    return
class __PinDigitalR:
  def read_digital(self):
    return 0
class __PinDigital(__PinDigitalR,__PinDigitalW):
  def read_digital(self):
    return 0   
class __PinAnalogW(__PinDigitalW):
  def write_analog(self,__value__):
    return
  def set_analog_period(self,__value__):
    return
  def set_analog_period_microseconds(self,__value__):
    return
class __PinAnalogR(__PinDigitalR):
  def read_analog(self):
    return 0
class __PinAnalog(__PinAnalogR,__PinAnalogW):
  pass
class __PinTouch():
  def is_touched(self):
    return True
class __PinFull(__PinAnalog,__PinTouch):
  pass
class __PinSpeaker(__PinAnalogW):
  def disable(self):
    return
  def enable(self):
    return
  def get_analog_period_microseconds(self):
    return 0
pin0=__PinFull()
pin1=__PinFull()
pin2=__PinFull()
pin3=__PinAnalog()
pin4=__PinAnalog()
pin5=__PinDigital()
pin6=__PinDigital()
pin7=__PinDigital()
pin8=__PinDigital()
pin9=__PinDigital()
pin10=__PinAnalog()
pin11=__PinDigital()
pin12=__PinDigital()
pin13=__PinDigital()
pin14=__PinDigital()
pin15=__PinDigital()
pin16=__PinDigital()
pin19=__PinDigital()
pin20=__PinDigital()
pin_logo=__PinTouch()
pin_speaker=__PinSpeaker()

class __UART:
  def init(self,_baudrate_,_bits_,_parity_,_stop_,tx=None,rx=None):
    return
  def any(self):
    return True
  def read(self,_nbytes=-1):
    return bytes()
  def readall(self):
    return bytes()
  def readinto(self,_buffer_,_nbytes_=-1):
    return 0
  def readline(self):
    return ""
  def write(self,_buffer_):
    return 0
uart=__UART()

class __SPI:
  def init(self,baudrate=1000000,bits=8,mode=0,sclk=pin13,mosi=pin15,miso=pin14):
    return
  def read(self,_nbytes_):
    return 0
  def write_readinto(self,_out_,_in_):
    return
  def write(self,_buffer_):
    return
spi=__SPI()

class __I2C:
  def init(self,freq=100000,sda=pin20,slc=pin19):
    return
  def scan(self):
    return [1,2]
  def read(self,_addr_,_nbytes_,repeat=False):
    return [1,2]
  def write(self,_addr_,_buffer_,repeat=False):
    return
i2c=__I2C()

class __Compass:
  def calibrate(self):
    return
  def is_calibrated(self):
    return True
  def clear_calibration(self):
    return
  def get_x(self):
    return 0
  def get_y(self):
    return 0
  def get_z(self):
    return 0
  def heading(self):
    return 0
  def get_field_strength(self):
    return 0
compass=__Compass()

class __Display:
  def get_pixel(self,_x_,_y_):
    return 0
  def set_pixel(self,_x_,_y_,_value_):
    return
  def clear(self):
    return
  def show(self,_value_,delay=400,*,wait=True,loop=False,clear=False):
    return
  def scroll(self,_value_, delay=150,*, wait=True, loop=False,monospace=False):
    return
  def on(self):
    return
  def off(self):
    return
  def is_on(self):
    return True
  def read_light_level(self):
    return 0
display=__Display()

class __Accelerometer:
  def get_x(self):
    return 0
  def get_y(self):
    return 0
  def get_z(self):
    return 0
  def get_values(self):
    return (1,2)
  def current_gesture(self):
    return ""
  def is_gesture(self,_name_):
    return True
  def was_gesture(self,_name_):
    return True
  def get_gestures(self):
    return ("","")
accelerometer=__Accelerometer()

class __Image:
  #only declared 1 constructor here... 
  def __init__(self,width=None, height=None,buffer=None):
    pass
  def width(self):
    return 0
  def height(self):
    return 0
  def set_pixel(self,_x_,_y_,_value_):
    return
  def get_pixel(self,_x_,_y_):
    return 0
  def shift_left(self,_n_):
    return Image()
  def shift_right(self,_n_):
    return Image()
  def shift_up(self,_n_):
    return Image()
  def shift_down(self,_n_):
    return Image()
  def crop(self,_x_,_y_,_w_,_h_):
    return Image()
  def copy(self):
    return Image()
  def invert(self):
   return Image()
  def fill(self,_value_):
    return
  def blit(self,_src_,_x_,_y_,_w_,_h_,xdest=0,_ydest=0):
    return Image()
Image = __Image()
Image.ANGRY=__Image()
Image.ARROW_E=__Image()
Image.ARROW_N=__Image()
Image.ARROW_NE=__Image()
Image.ARROW_NW=__Image()
Image.ARROW_S=__Image()
Image.ARROW_SE=__Image()
Image.ARROW_SW=__Image()
Image.ARROW_W=__Image()
Image.ASLEEP=__Image()
Image.BUTTERFLY=__Image()
Image.CHESSBOARD=__Image()
Image.CLOCK1=__Image()
Image.CLOCK10=__Image()
Image.CLOCK11=__Image()
Image.CLOCK12=__Image()
Image.CLOCK2=__Image()
Image.CLOCK3=__Image()
Image.CLOCK4=__Image()
Image.CLOCK5=__Image()
Image.CLOCK6=__Image()
Image.CLOCK7=__Image()
Image.CLOCK8=__Image()
Image.CLOCK9=__Image()
Image.CONFUSED=__Image()
Image.COW=__Image()
Image.DIAMOND=__Image()
Image.DIAMOND_SMALL=__Image()
Image.DUCK=__Image()
Image.FABULOUS=__Image()
Image.GHOST=__Image()
Image.GIRAFFE=__Image()
Image.HAPPY=__Image()
Image.HEART=__Image()
Image.HEART_SMALL=__Image()
Image.HOUSE=__Image()
Image.MEH=__Image()
Image.MUSIC_CROTCHET=__Image()
Image.MUSIC_QUAVER=__Image()
Image.MUSIC_QUAVERS=__Image()
Image.NO=__Image()
Image.PACMAN=__Image()
Image.PITCHFORK=__Image()
Image.RABBIT=__Image()
Image.ROLLERSKATE=__Image()
Image.SAD=__Image()
Image.SILLY=__Image()
Image.SKULL=__Image()
Image.SMILE=__Image()
Image.SNAKE=__Image()
Image.SQUARE=__Image()
Image.SQUARE_SMALL=__Image()
Image.STICKFIGURE=__Image()
Image.SURPRISED=__Image()
Image.SWORD=__Image()
Image.TARGET=__Image()
Image.TORTOISE=__Image()
Image.TRIANGLE=__Image()
Image.TRIANGLE_LEFT=__Image()
Image.TSHIRT=__Image()
Image.UMBRELLA=__Image()
Image.XMAS=__Image()
Image.YES=__Image()
Image.ALL_CLOCKS=(__Image(),__Image())
Image.ALL_ARROWS=(__Image(),__Image())