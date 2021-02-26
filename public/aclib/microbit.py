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

class Image:
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
Image.ANGRY=Image()
Image.ARROW_E=Image()
Image.ARROW_N=Image()
Image.ARROW_NE=Image()
Image.ARROW_NW=Image()
Image.ARROW_S=Image()
Image.ARROW_SE=Image()
Image.ARROW_SW=Image()
Image.ARROW_W=Image()
Image.ASLEEP=Image()
Image.BUTTERFLY=Image()
Image.CHESSBOARD=Image()
Image.CLOCK1=Image()
Image.CLOCK10=Image()
Image.CLOCK11=Image()
Image.CLOCK12=Image()
Image.CLOCK2=Image()
Image.CLOCK3=Image()
Image.CLOCK4=Image()
Image.CLOCK5=Image()
Image.CLOCK6=Image()
Image.CLOCK7=Image()
Image.CLOCK8=Image()
Image.CLOCK9=Image()
Image.CONFUSED=Image()
Image.COW=Image()
Image.DIAMOND=Image()
Image.DIAMOND_SMALL=Image()
Image.DUCK=Image()
Image.FABULOUS=Image()
Image.GHOST=Image()
Image.GIRAFFE=Image()
Image.HAPPY=Image()
Image.HEART=Image()
Image.HEART_SMALL=Image()
Image.HOUSE=Image()
Image.MEH=Image()
Image.MUSIC_CROTCHET=Image()
Image.MUSIC_QUAVER=Image()
Image.MUSIC_QUAVERS=Image()
Image.NO=Image()
Image.PACMAN=Image()
Image.PITCHFORK=Image()
Image.RABBIT=Image()
Image.ROLLERSKATE=Image()
Image.SAD=Image()
Image.SILLY=Image()
Image.SKULL=Image()
Image.SMILE=Image()
Image.SNAKE=Image()
Image.SQUARE=Image()
Image.SQUARE_SMALL=Image()
Image.STICKFIGURE=Image()
Image.SURPRISED=Image()
Image.SWORD=Image()
Image.TARGET=Image()
Image.TORTOISE=Image()
Image.TRIANGLE=Image()
Image.TRIANGLE_LEFT=Image()
Image.TSHIRT=Image()
Image.UMBRELLA=Image()
Image.XMAS=Image()
Image.YES=Image()
Image.ALL_CLOCKS=(Image(),Image())
Image.ALL_ARROWS=(Image(),Image())