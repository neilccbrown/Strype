# The turtle API in Python was originally written by Gregor Lindl under the following license:
# ===========================================================================================
# turtle.py: a Tkinter based turtle graphics module for Python
# Version 1.1b - 4. 5. 2009
#
# Copyright (C) 2006 - 2010 Gregor Lingl
# email: glingl@aon.at
#
# This software is provided 'as-is', without any express or implied
# warranty. In no event will the authors be held liable for any damages
# arising from the use of this software.
#
# Permission is granted to anyone to use this software for any purpose,
# including commercial applications, and to alter it and redistribute it
# freely, subject to the following restrictions:
#
# 1. The origin of this software must not be misrepresented; you must not
#    claim that you wrote the original software. If you use this software
#    in a product, an acknowledgment in the product documentation would be
#    appreciated but is not required.
# 2. Altered source versions must be plainly marked as such, and must not be
#    misrepresented as being the original software.
# 3. This notice may not be removed or altered from any source distribution.
# ===========================================================================================
#
# This API was then reimplemented by Clemens Bachmann and Dennis Komm under the following license
# ===========================================================================================
# # Mozilla Public License Version 2.0
# 
# ### 1. Definitions
# 
# **1.1. “Contributor”**  
#  means each individual or legal entity that creates, contributes to
# the creation of, or owns Covered Software.
# 
# **1.2. “Contributor Version”**  
#  means the combination of the Contributions of others (if any) used
# by a Contributor and that particular Contributor's Contribution.
# 
# **1.3. “Contribution”**  
#  means Covered Software of a particular Contributor.
# 
# **1.4. “Covered Software”**  
#  means Source Code Form to which the initial Contributor has attached
# the notice in Exhibit A, the Executable Form of such Source Code
# Form, and Modifications of such Source Code Form, in each case
# including portions thereof.
# 
# **1.5. “Incompatible With Secondary Licenses”**  
#  means
# 
# - **(a)** that the initial Contributor has attached the notice described
#   in Exhibit B to the Covered Software; or
# - **(b)** that the Covered Software was made available under the terms of
#   version 1.1 or earlier of the License, but not also under the
#   terms of a Secondary License.
# 
# **1.6. “Executable Form”**  
#  means any form of the work other than Source Code Form.
# 
# **1.7. “Larger Work”**  
#  means a work that combines Covered Software with other material, in
# a separate file or files, that is not Covered Software.
# 
# **1.8. “License”**  
#  means this document.
# 
# **1.9. “Licensable”**  
#  means having the right to grant, to the maximum extent possible,
# whether at the time of the initial grant or subsequently, any and
# all of the rights conveyed by this License.
# 
# **1.10. “Modifications”**  
#  means any of the following:
# 
# - **(a)** any file in Source Code Form that results from an addition to,
#   deletion from, or modification of the contents of Covered
#   Software; or
# - **(b)** any new file in Source Code Form that contains any Covered
#   Software.
# 
# **1.11. “Patent Claims” of a Contributor**  
#  means any patent claim(s), including without limitation, method,
# process, and apparatus claims, in any patent Licensable by such
# Contributor that would be infringed, but for the grant of the
# License, by the making, using, selling, offering for sale, having
# made, import, or transfer of either its Contributions or its
# Contributor Version.
# 
# **1.12. “Secondary License”**  
#  means either the GNU General Public License, Version 2.0, the GNU
# Lesser General Public License, Version 2.1, the GNU Affero General
# Public License, Version 3.0, or any later versions of those
# licenses.
# 
# **1.13. “Source Code Form”**  
#  means the form of the work preferred for making modifications.
# 
# **1.14. “You” (or “Your”)**  
#  means an individual or a legal entity exercising rights under this
# License. For legal entities, “You” includes any entity that
# controls, is controlled by, or is under common control with You. For
# purposes of this definition, “control” means **(a)** the power, direct
# or indirect, to cause the direction or management of such entity,
# whether by contract or otherwise, or **(b)** ownership of more than
# fifty percent (50%) of the outstanding shares or beneficial
# ownership of such entity.
# 
# ### 2. License Grants and Conditions
# 
# #### 2.1. Grants
# 
# Each Contributor hereby grants You a world-wide, royalty-free,
# non-exclusive license:
# 
# - **(a)** under intellectual property rights (other than patent or trademark)
#   Licensable by such Contributor to use, reproduce, make available,
#   modify, display, perform, distribute, and otherwise exploit its
#   Contributions, either on an unmodified basis, with Modifications, or
#   as part of a Larger Work; and
# - **(b)** under Patent Claims of such Contributor to make, use, sell, offer
#   for sale, have made, import, and otherwise transfer either its
#   Contributions or its Contributor Version.
# 
# #### 2.2. Effective Date
# 
# The licenses granted in Section 2.1 with respect to any Contribution
# become effective for each Contribution on the date the Contributor first
# distributes such Contribution.
# 
# #### 2.3. Limitations on Grant Scope
# 
# The licenses granted in this Section 2 are the only rights granted under
# this License. No additional rights or licenses will be implied from the
# distribution or licensing of Covered Software under this License.
# Notwithstanding Section 2.1(b) above, no patent license is granted by a
# Contributor:
# 
# - **(a)** for any code that a Contributor has removed from Covered Software;
#   or
# - **(b)** for infringements caused by: **(i)** Your and any other third party's
#   modifications of Covered Software, or **(ii)** the combination of its
#   Contributions with other software (except as part of its Contributor
#   Version); or
# - **(c)** under Patent Claims infringed by Covered Software in the absence of
#   its Contributions.
# 
# This License does not grant any rights in the trademarks, service marks,
# or logos of any Contributor (except as may be necessary to comply with
# the notice requirements in Section 3.4).
# 
# #### 2.4. Subsequent Licenses
# 
# No Contributor makes additional grants as a result of Your choice to
# distribute the Covered Software under a subsequent version of this
# License (see Section 10.2) or under the terms of a Secondary License (if
# permitted under the terms of Section 3.3).
# 
# #### 2.5. Representation
# 
# Each Contributor represents that the Contributor believes its
# Contributions are its original creation(s) or it has sufficient rights
# to grant the rights to its Contributions conveyed by this License.
# 
# #### 2.6. Fair Use
# 
# This License is not intended to limit any rights You have under
# applicable copyright doctrines of fair use, fair dealing, or other
# equivalents.
# 
# #### 2.7. Conditions
# 
# Sections 3.1, 3.2, 3.3, and 3.4 are conditions of the licenses granted
# in Section 2.1.
# 
# ### 3. Responsibilities
# 
# #### 3.1. Distribution of Source Form
# 
# All distribution of Covered Software in Source Code Form, including any
# Modifications that You create or to which You contribute, must be under
# the terms of this License. You must inform recipients that the Source
# Code Form of the Covered Software is governed by the terms of this
# License, and how they can obtain a copy of this License. You may not
# attempt to alter or restrict the recipients' rights in the Source Code
# Form.
# 
# #### 3.2. Distribution of Executable Form
# 
# If You distribute Covered Software in Executable Form then:
# 
# - **(a)** such Covered Software must also be made available in Source Code
#   Form, as described in Section 3.1, and You must inform recipients of
#   the Executable Form how they can obtain a copy of such Source Code
#   Form by reasonable means in a timely manner, at a charge no more
#   than the cost of distribution to the recipient; and
# 
# - **(b)** You may distribute such Executable Form under the terms of this
#   License, or sublicense it under different terms, provided that the
#   license for the Executable Form does not attempt to limit or alter
#   the recipients' rights in the Source Code Form under this License.
# 
# #### 3.3. Distribution of a Larger Work
# 
# You may create and distribute a Larger Work under terms of Your choice,
# provided that You also comply with the requirements of this License for
# the Covered Software. If the Larger Work is a combination of Covered
# Software with a work governed by one or more Secondary Licenses, and the
# Covered Software is not Incompatible With Secondary Licenses, this
# License permits You to additionally distribute such Covered Software
# under the terms of such Secondary License(s), so that the recipient of
# the Larger Work may, at their option, further distribute the Covered
# Software under the terms of either this License or such Secondary
# License(s).
# 
# #### 3.4. Notices
# 
# You may not remove or alter the substance of any license notices
# (including copyright notices, patent notices, disclaimers of warranty,
# or limitations of liability) contained within the Source Code Form of
# the Covered Software, except that You may alter any license notices to
# the extent required to remedy known factual inaccuracies.
# 
# #### 3.5. Application of Additional Terms
# 
# You may choose to offer, and to charge a fee for, warranty, support,
# indemnity or liability obligations to one or more recipients of Covered
# Software. However, You may do so only on Your own behalf, and not on
# behalf of any Contributor. You must make it absolutely clear that any
# such warranty, support, indemnity, or liability obligation is offered by
# You alone, and You hereby agree to indemnify every Contributor for any
# liability incurred by such Contributor as a result of warranty, support,
# indemnity or liability terms You offer. You may include additional
# disclaimers of warranty and limitations of liability specific to any
# jurisdiction.
# 
# ### 4. Inability to Comply Due to Statute or Regulation
# 
# If it is impossible for You to comply with any of the terms of this
# License with respect to some or all of the Covered Software due to
# statute, judicial order, or regulation then You must: **(a)** comply with
# the terms of this License to the maximum extent possible; and **(b)**
# describe the limitations and the code they affect. Such description must
# be placed in a text file included with all distributions of the Covered
# Software under this License. Except to the extent prohibited by statute
# or regulation, such description must be sufficiently detailed for a
# recipient of ordinary skill to be able to understand it.
# 
# ### 5. Termination
# 
# **5.1.** The rights granted under this License will terminate automatically
# if You fail to comply with any of its terms. However, if You become
# compliant, then the rights granted under this License from a particular
# Contributor are reinstated **(a)** provisionally, unless and until such
# Contributor explicitly and finally terminates Your grants, and **(b)** on an
# ongoing basis, if such Contributor fails to notify You of the
# non-compliance by some reasonable means prior to 60 days after You have
# come back into compliance. Moreover, Your grants from a particular
# Contributor are reinstated on an ongoing basis if such Contributor
# notifies You of the non-compliance by some reasonable means, this is the
# first time You have received notice of non-compliance with this License
# from such Contributor, and You become compliant prior to 30 days after
# Your receipt of the notice.
# 
# **5.2.** If You initiate litigation against any entity by asserting a patent
# infringement claim (excluding declaratory judgment actions,
# counter-claims, and cross-claims) alleging that a Contributor Version
# directly or indirectly infringes any patent, then the rights granted to
# You by any and all Contributors for the Covered Software under Section
# 2.1 of this License shall terminate.
# 
# **5.3.** In the event of termination under Sections 5.1 or 5.2 above, all
# end user license agreements (excluding distributors and resellers) which
# have been validly granted by You or Your distributors under this License
# prior to termination shall survive termination.
# 
# ### 6. Disclaimer of Warranty
# 
# > Covered Software is provided under this License on an “as is”
# > basis, without warranty of any kind, either expressed, implied, or
# > statutory, including, without limitation, warranties that the
# > Covered Software is free of defects, merchantable, fit for a
# > particular purpose or non-infringing. The entire risk as to the
# > quality and performance of the Covered Software is with You.
# > Should any Covered Software prove defective in any respect, You
# > (not any Contributor) assume the cost of any necessary servicing,
# > repair, or correction. This disclaimer of warranty constitutes an
# > essential part of this License. No use of any Covered Software is
# > authorized under this License except under this disclaimer.
# 
# ### 7. Limitation of Liability
# 
# > Under no circumstances and under no legal theory, whether tort
# > (including negligence), contract, or otherwise, shall any
# > Contributor, or anyone who distributes Covered Software as
# > permitted above, be liable to You for any direct, indirect,
# > special, incidental, or consequential damages of any character
# > including, without limitation, damages for lost profits, loss of
# > goodwill, work stoppage, computer failure or malfunction, or any
# > and all other commercial damages or losses, even if such party
# > shall have been informed of the possibility of such damages. This
# > limitation of liability shall not apply to liability for death or
# > personal injury resulting from such party's negligence to the
# > extent applicable law prohibits such limitation. Some
# > jurisdictions do not allow the exclusion or limitation of
# > incidental or consequential damages, so this exclusion and
# > limitation may not apply to You.
# 
# ### 8. Litigation
# 
# Any litigation relating to this License may be brought only in the
# courts of a jurisdiction where the defendant maintains its principal
# place of business and such litigation shall be governed by laws of that
# jurisdiction, without reference to its conflict-of-law provisions.
# Nothing in this Section shall prevent a party's ability to bring
# cross-claims or counter-claims.
# 
# ### 9. Miscellaneous
# 
# This License represents the complete agreement concerning the subject
# matter hereof. If any provision of this License is held to be
# unenforceable, such provision shall be reformed only to the extent
# necessary to make it enforceable. Any law or regulation which provides
# that the language of a contract shall be construed against the drafter
# shall not be used to construe this License against a Contributor.
# 
# ### 10. Versions of the License
# 
# #### 10.1. New Versions
# 
# Mozilla Foundation is the license steward. Except as provided in Section
# 10.3, no one other than the license steward has the right to modify or
# publish new versions of this License. Each version will be given a
# distinguishing version number.
# 
# #### 10.2. Effect of New Versions
# 
# You may distribute the Covered Software under the terms of the version
# of the License under which You originally received the Covered Software,
# or under the terms of any subsequent version published by the license
# steward.
# 
# #### 10.3. Modified Versions
# 
# If you create software not governed by this License, and you want to
# create a new license for such software, you may create and use a
# modified version of this License if you rename the license and remove
# any references to the name of the license steward (except to note that
# such modified license differs from this License).
# 
# #### 10.4. Distributing Source Code Form that is Incompatible With Secondary Licenses
# 
# If You choose to distribute Source Code Form that is Incompatible With
# Secondary Licenses under the terms of this version of the License, the
# notice described in Exhibit B of this License must be attached.
# 
# ## Exhibit A - Source Code Form License Notice
# 
#     This Source Code Form is subject to the terms of the Mozilla Public
#     License, v. 2.0. If a copy of the MPL was not distributed with this
#     file, You can obtain one at http://mozilla.org/MPL/2.0/.
# 
# If it is not possible or desirable to put the notice in a particular
# file, then You may include the notice in a location (such as a LICENSE
# file in a relevant directory) where a recipient would be likely to look
# for such a notice.
# 
# You may add additional accurate notices of copyright ownership.
# 
# ## Exhibit B - “Incompatible With Secondary Licenses” Notice
# 
#     This Source Code Form is "Incompatible With Secondary Licenses", as
#     defined by the Mozilla Public License, v. 2.0.
# ===========================================================================================
#
# We (the Strype developers) have now adapted the WebTigerPython version to work in Strype, and have used the
# license compatibility listed here: https://www.gnu.org/licenses/license-list.html#MPL-2.0 which allows us
# to distribute our version under the AGPL 3.0 like the rese of the Strype project, but this file specifically
# remains dual-licensed under the MPL 2.0 as suggested on the GNU webpage.
#
# We are also grateful to the WebTigerPython developers for their support in using their Turtle implementation.

import time as _time
import math as _math
# Named this way to avoid having to change the code too much from WebTigerPython, in case we want to diff
# changes in future:
from strype_bridge import strype_turtle_internal as defaultrunner
import typing as _typing
#from TigerPython import Color, makeColor as make_color # TODO fix this, ideally use Strype's color
from strype.graphics import Color, color_from_string as _color_from_string
import inspect as _inspect
import sys as _sys
# from typeguard import typechecked

# NCCB: This is a paste from WebTigerPython's param.py, but to minimise namespace pollution we prefix
# all the items with an underscore
###################################################################################################
_MAKE = 'makeTurtle'
_INITCANVAS = 'initCanvas'
_GETMODE = "getMode"
_SETMODE = "setMode"
_SCREENCOLOR = 'screenColor'
_CLEAR = 'clear'
_CLEARSCREEN = 'clearScreen'
# NCCB: Removed _SAVEPLAYGROUND = 'savePlayground'
_CLEAN = 'clean'
_GETPIXELCOLOR = 'getPixelColor'
_KEYPRESSED = "keyPressed"
_KEYCODEPRESSED = "keyCodePressed"
_WINDOWDIMS = 'getWindowDims'
_TRACER = 'tracer'
_UPDATE = 'update'

# Move and draw
_MOVE = 'moveTurtle'
_ROTATE = 'rotateTurtle'
_SETPOSITION = 'setposition'
_TELEPORT = 'teleport'
_SETX = 'setx'
_SETY = 'sety'
_SETHEADING = 'setheading'
_CIRCLE = 'circle'
_DOT = 'dot'
_STAMP = 'stamp'
_CLEARSTAMP = 'clearstamp'
_CLEARSTAMPS = 'clearstamps'
_SPEED = 'speed'

# Tell Turtle's state
_POSITION = 'position'
_TOWARDS = 'towards'
_XCOR = 'xcor'
_YCOR = 'ycor'
_HEADING = 'heading'
_DISTANCE = 'distance'

# Drawing state
_PEN = 'pen'
_PENSIZE = 'pensize'
_ISDOWN = 'isdown'

# Color control
_PENCOLOR = 'pencolor'
_FILLCOLOR = 'fillcolor'
_GETCOLOR = 'getcolor'

# Filling
_FILLING = 'filling'
_BEGINFILL = 'begin_fill'
_ENDFILL = 'end_fill'

# More drawing control
_WRITE = 'write'

# Visibility
_HIDETURTLE = 'hideTurtle'
_ISVISIBLE = 'isvisible'

# Appearance
_SHAPE = 'shape'
_ISSHAPE = 'isshape'
_GETSHAPE = 'getshape'
_RESIZEMODE = 'resizemode'
_SHAPESIZE = 'shapesize'
_SHEARFACTOR = 'shearfactor'
_SETTILTANGLE = 'settiltangle'
_TILTANGLE = 'tiltangle'
_TILT = 'tilt'
_SHAPETRANSFORM = 'shapetransform'
_GET_SHAPEPOLY = 'get_shapepoly'

# Events
_GETEVENTLOG = 'getEventLog'
_SETEVENTMODE = 'setEventMode'
_FOCUS = 'focus'

# Settings and special methods
_MODE = 'mode'
_COLORMODE = 'colormode'
_GETCANVAS = 'getcanvas'
_GETSHAPES = 'getshapes'
_REGISTER_SHAPE = 'register_shape'
_TURTLES = 'turtles'
_WINDOW_HEIGHT = 'window_height'
_WINDOW_WIDTH = 'window_width'

###################################################################################################

# NCCB simplified version of make_color:
def make_color(*args):
    if len(args) == 1:
        if type(args[0]) == Color:
            return args[0]
        elif type(args[0]) == str:
            return _color_from_string(args[0])
        elif type(args[0]) in [tuple, list]:
            return make_color(*args[0])
        else:
            raise TypeError(f"invalid argument(s) for 'makeColor()': {args}")
    else:
        return Color(*args)
def _pixi_color(c):
    return [c.red, c.green, c.blue, c.alpha]


_BUFFER_SIZE = 1
_TURTLE_BUFFER = []
_VALID_MODES = ['standard', 'logo']
_EVENT_FUNC_DICT = dict()
_CURRENT_TURTLE_ID = 0


def reset(dispatch=True):
    if dispatch and Screen().auto_repaint:
        Screen().update()
    else:
        global _TURTLE_BUFFER
        _TURTLE_BUFFER = []
    global _BUFFER_SIZE
    _BUFFER_SIZE = 1
    global _CURRENT_TURTLE_ID
    _CURRENT_TURTLE_ID = 0
    global _EVENT_FUNC_DICT
    _EVENT_FUNC_DICT = dict()
    Turtle._fullCircle = 360
    Screen()._turtlesList.clear()
    Turtle.__resetTurtleClass__()


def _dispatch_buffer():
    '''
    Sends content of the buffer to PIXIJS to execute turtle movement on the Canvas
    '''
    if len(_TURTLE_BUFFER) > 0:
        turtleBufferTmp = _TURTLE_BUFFER.copy()
        _TURTLE_BUFFER.clear()
        return defaultrunner.callback('turtle', data=turtleBufferTmp)


def _add_action(command, args=None, id=None):
    '''
    Adds an action to the turtle buffer. the buffer is dispatched when a limit is reached.
    Normally buffersize is 1. However, for animations, this is needed for performance.
    '''
    _TURTLE_BUFFER.append([command, args, id])
    if len(_TURTLE_BUFFER) >= _BUFFER_SIZE:
        _dispatch_buffer()


def _return_action(command, args=None, id=None):
    '''
    This is used to bypass dispatching the buffer update to query key or mouse events
    '''
    return defaultrunner.callback('turtle', data=[[command, args, id]])


def _dispatch_return_action(command, args=None, id=None):
    _dispatch_buffer()
    _TURTLE_BUFFER.append([command, args, id])
    turtleBufferTmp = _TURTLE_BUFFER.copy()
    _TURTLE_BUFFER.clear()
    return defaultrunner.callback('turtle', data=turtleBufferTmp)


def _round(x):
    # to round minimal differences
    return float(1000 + x - 1000)


def _round(num):
    # to round minimal differences
    if num == 0:
        return 0.0  # Handle zero case
    else:
        # Calculate the order of magnitude
        magnitude = int(_math.floor(_math.log10(abs(num))))
        # Calculate the rounding factor
        rounding_factor = 10 ** (10 - magnitude - 1)
        return round(num * rounding_factor) / rounding_factor


def Screen():
    if Turtle._screen is None:
        Turtle._screen = _Screen()
    return Turtle._screen

# Window control


class _Screen:
    _turtlesList = []
    auto_repaint = True

    def __init__(self):
        if Turtle._screen is None:
            _add_action(_INITCANVAS)

    # Canvas Functions
    def clearscreen(self):
        '''
        erases the traces and sets turtle back to starting position
        '''
        reset(False)
    clear = clearscreen

    def bgcolor(self, *args):
        color = _pixi_color(make_color(*args))
        _add_action(_SCREENCOLOR, color)

    def bgpic(self, *args):
        raise NotImplementedError()

    def resetscreen(self, *args):
        raise NotImplementedError()
    # reset = resetscreen

    def screensize(self, *args):
        raise NotImplementedError()

    def setworldcoordinates(self, *args):
        raise NotImplementedError()

    # Animation control
    def delay(self, duration: float):
        '''
        delay turtle by duration seconds
        '''
        start = _time.time()
        if duration < 0:
            raise Exception("delay can only be used with positive numbers")
        if self.auto_repaint:
            _dispatch_buffer()
        if len(_EVENT_FUNC_DICT) > 0:
            self._handle_events(False)
        end = _time.time()
        duration = max(duration - (end - start), 0)
        _time.sleep(duration/1000)

    def update(self):
        """
        rendert den Bildschirm (nach dem Ausschalten des automatischen Rendering)
        """
        _add_action(_UPDATE)
        _dispatch_buffer()

    def tracer(self, n=0, delay=0, hideturtle=False):
        global _BUFFER_SIZE
        if hideturtle:
            n = 1
            for turtle in self._turtlesList:
                turtle.speed(100)
            self.auto_repaint = True
        elif n > 0:
            _BUFFER_SIZE = n
            self.auto_repaint = True
        else:
            _BUFFER_SIZE = _sys.maxsize
            self.auto_repaint = False
        _add_action(_TRACER, [n, delay])

    keydict = {
        "Right": "ArrowRight",
        "Left": "ArrowLeft",
        "Down": "ArrowDown",
        "Up": "ArrowUp",
    }
    # screen events

    def onkey(self, fun, key):
        if key in self.keydict:
            key = self.keydict[key]
        funcstr = 'keyup' + key
        update_func(funcstr, fun, False)
    onkeyrelease = onkey

    def onkeypress(self, fun, key):
        funcstr = 'keypress' + key
        update_func(funcstr, fun, False)

    def listen(self):
        _add_action(_FOCUS)
        _dispatch_buffer()

    def ontimer(self, *args):
        raise NotImplementedError()

    def _handle_events(self, blocking):
        events = get_event_log(blocking)
        for event in events:
            eventstr = event['name'] + event['key']
            pos = event['pos'] if 'pos' in event else None
            if eventstr in _EVENT_FUNC_DICT:
                if pos:
                    _EVENT_FUNC_DICT[eventstr](pos[0], pos[1])
                else:
                    _EVENT_FUNC_DICT[eventstr]()
            eventstrany = event['name'] + 'any'
            if eventstrany in _EVENT_FUNC_DICT:
                _EVENT_FUNC_DICT[eventstrany](event['key'])
        _dispatch_buffer()

    def mainloop(self):
        _dispatch_buffer()
        set_event_mode(True)
        while len(_EVENT_FUNC_DICT) > 0:
            self._handle_events(True)
        set_event_mode(False)

    # Settings and special methods
    def mode(self, mode=None):
        '''
        Select turtle mode. Valid modes are "standard" and "logo".
        '''
        if mode is None:
            return _dispatch_return_action(_GETMODE)
        elif mode in _VALID_MODES:
            _add_action(_SETMODE, mode)
        else:
            raise ValueError(f"mode \"{mode}\" must be in {_VALID_MODES}")

    def colormode(self, *args):
        raise NotImplementedError()

    def getcanvas(self, *args):
        raise NotImplementedError()

    def getshapes(self, *args):
        raise NotImplementedError()

    def register_shape(self, *args):
        raise NotImplementedError()
    addshape = register_shape

    def turtles(self):
        return self._turtlesList

    def window_height(self, *args):
        return _dispatch_return_action(_WINDOWDIMS)[1]

    def window_width(self, *args):
        return _dispatch_return_action(_WINDOWDIMS)[0]

    # input methods
    def textinput(self, title: str, prompt: str = ''):
        return input(title + " " + prompt)

    def numinput(self, title: str, prompt: str = ''):
        return float(input(title + " " + prompt))

    # Methods specific to screen
    def bye(self):
        _dispatch_buffer()
        Turtle._screen = None

    # Events
    def onclick(self, fun, btn=1, add=False):
        funcstr = 'click' + str(btn)
        update_func(funcstr, fun, add)
    onscreenclick = onclick

    def ondrag(self, fun, btn=1, add=False):
        funcstr = 'drag' + str(btn)
        update_func(funcstr, fun, add)

    def exitonclick(self, *args):
        raise NotImplementedError()

    def setup(self, *args):
        raise NotImplementedError()

    def title(self, title):
        defaultrunner.callback("title", data=["turtle", title])

    # Our functions
    def onmove(self, fun, add=False):
        # we append a 0 for consistencty, however onmove is not mapped to a button
        funcstr = 'move'
        update_func(funcstr, fun, add)

    def get_key(self):
        self.listen()
        events = get_event_log(False)
        if events:
            for event in events[::-1]:
                if event['name'] == 'keypress':
                    return event['key']
                else:
                    return ""
        else:
            return ""

    def get_key_wait(self):
        self.listen()
        events = None
        set_event_mode(True)
        while not events:
            events = get_event_log(True)
            if events:
                i = 0
                while not events[i]['name'] == 'keypress':
                    i = i+1
                    if i >= len(events):
                        events = get_event_log(True)
                        i = 0
        set_event_mode(False)
        return events[i]['key']

    def is_key_pressed(self, key: str):
        return defaultrunner.callback("isKeyPressed", key=key, type="key")

    def get_key_code(self):
        self.listen()
        events = get_event_log(False)
        if events:
            for event in events[::-1]:
                if event['name'] == 'keypress':
                    return event['keyCode']
                else:
                    return ""
        else:
            return ""

    def get_key_code_wait(self):
        self.listen()
        events = None
        set_event_mode(True)
        while not events:
            events = get_event_log(True)
            if events:
                i = 0
                while not events[i]['name'] == 'keypress':
                    i = i+1
                    if i >= len(events):
                        events = get_event_log(True)
                        i = 0
        set_event_mode(False)
        return events[i]['keyCode']

    def is_key_code_pressed(self, key: int):
        return defaultrunner.callback("isKeyPressed", key=key, type="keyCode")


def Screen():
    """Return the singleton screen object.
    If none exists at the moment, create a new one and return it,
    else return the existing one."""
    if Turtle._screen is None:
        Turtle._screen = _Screen()
    return Turtle._screen

# Our functions

# @typechecked


class Turtle:
    _pen = None
    _screen = None
    _fullCircle = 360
    _pencolor = Color(0.0, 0.0, 0.0, 1.0)
    _fillcolor = Color(0.0, 0.0, 0.0, 1.0)

    def __init__(self, shape: str = None, undobuffersize: int = None, isvisible: bool = True):
        if undobuffersize:
            raise NotImplementedError()
        Screen()._turtlesList.append(self)
        global _CURRENT_TURTLE_ID
        self.id = _CURRENT_TURTLE_ID
        _CURRENT_TURTLE_ID += 1
        _add_action(_MAKE, id=self.id)
        if not isvisible:
            _add_action(_HIDETURTLE, 1, self.id)
        if shape:
            if _dispatch_return_action(_ISSHAPE, shape, id=self.id) or shape == "circle":
                _add_action(_SHAPE, shape, self.id)
            else:
                raise NameError("invalid shape name")
        else:
            _add_action(_SHAPE, "classic", self.id)

    @classmethod
    def __resetTurtleClass__(cls):
        cls._pen = None
        cls._screen = None

    def clear(self, color=None):
        _add_action(_CLEAR, id=self.id)

    def clean(self, color=None):
        _add_action(_CLEAN, id=self.id)

    # Move and draw
    # @typechecked
    def forward(self, steps: float):
        '''
        move turtle steps pixels forward
        '''
        _add_action(_MOVE, steps, self.id)
    fd = forward

    def backward(self, steps: float):
        '''
        move turtle steps pixels back
        '''
        # return defaultrunner.callback('turtle', data=[_MOVE, -steps])
        _add_action(_MOVE, -steps, self.id)
    back = backward
    bk = backward

    def right(self, deg: float):
        '''
        rotate Turtle by deg to the right
        '''
        rad = (deg/self._fullCircle) * _math.pi * 2
        # return defaultrunner.callback('turtle', data=[_ROTATE, deg])
        _add_action(_ROTATE, rad, self.id)
    rt = right

    def left(self, deg: float):
        '''
        rotate Turtle by deg to the left
        '''
        rad = (deg/self._fullCircle) * _math.pi * 2
        # return defaultrunner.callback('turtle', data=[_ROTATE, -deg])
        _add_action(_ROTATE, -rad, self.id)
    lt = left

    def setposition(self, x: _typing.Union[float, _typing.Tuple[float, float]], y: _typing.Optional[float] = None):
        '''
        Set the absolute position of the turtle manually.
        '''
        if isinstance(x, _typing.Tuple) or isinstance(x, _typing.List) and len(x) == 2 and y == None:
            x, y = x
            _add_action(_SETPOSITION, [x, -y], self.id)
        elif isinstance(x, (float, int)) and isinstance(y, (float, int)):
            _add_action(_SETPOSITION, [x, -y], self.id)
        else:
            raise TypeError("invalid argument types")
    setpos = setposition
    goto = setposition

    def teleport(self, x: _typing.Union[float, _typing.Tuple[float, float]], y: _typing.Optional[float] = None, fill_gap: _typing.Optional[bool] = False):
        '''
        '''
        if isinstance(x, _typing.Tuple) and y == None:
            x, y = x
            _add_action(_TELEPORT, [x, -y, fill_gap], self.id)
        elif isinstance(x, (float, int)) and isinstance(y, (float, int)):
            _add_action(_TELEPORT, [x, -y, fill_gap], self.id)
        else:
            raise TypeError("invalid argument types")

    def setx(self, x: float):
        '''
        set the absolute position of the x-coordinate of the turtle
        '''
        _add_action(_SETX, x, self.id)

    def sety(self, y: float):
        '''
        set the absolute position of the x-coordinate of the turtle
        '''
        _add_action(_SETY, -y, self.id)

    def setheading(self, deg: float):
        '''
        set the absolute heading of the turtle
        '''
        rad = (deg/self._fullCircle) * _math.pi * 2
        _add_action(_SETHEADING, rad, self.id)
    seth = setheading

    def home(self):
        '''
        return to the center and set the heading of the turtle to 0 so it's facing up
        '''
        self.setposition(0, 0)
        self.setheading(0)

    def circle(self, radius: float, extent: _typing.Optional[float] = None, steps: _typing.Optional[int] = None):
        '''
        draws an arc to the left with the given radius, angle and in the given steps
        '''
        if extent:
            rad = (extent/self._fullCircle) * _math.pi * 2
        else:
            rad = _math.pi*2
        _add_action(_CIRCLE, [radius, rad, steps], self.id)

    def dot(self, diameter=None):
        '''
        draws a filled circle
        '''
        if diameter != None and diameter < 0:
            raise Exception("diameter has to be positive")
        if diameter == None:
            diameter = -1
        _add_action(_DOT, diameter, self.id)

    def stamp(self):
        '''
        stamp a copy of the turtle shape onto the canvas at the current position. return a stamp_id for that stamp
        '''
        return _dispatch_return_action(_STAMP, id=self.id)

    def clearstamp(self, stamp_id: int):
        '''
        delete stamp with given stampid
        '''
        _add_action(_CLEARSTAMP, stamp_id, self.id)

    def clearstamps(self, stamp_ids: _typing.Optional[int] = None):
        '''
        delete all stamps if no args given 
        -2 deletes the last two stamps
        2 deletes the first two stamps
        '''
        _add_action(_CLEARSTAMPS, stamp_ids, self.id)

    def undo(self, *args):
        raise NotImplementedError()

    def speed(self, newSpeed: float):
        '''
        sets the speed of the turtle movement 
        :param newSpeed: (1 to 1000, default 500) With speed (-1) the turtle moves the fastest (without animation)
        '''
        _add_action(_SPEED, newSpeed, self.id)

    # Tell Turtle's state

    def position(self):
        '''
        returns the coordinates of the current turtle position
        '''
        posArray = _dispatch_return_action(_POSITION, id=self.id)
        x = float(posArray[0])
        y = float(-posArray[1])
        return (x, y)
    pos = position

    def towards(self, x: _typing.Union[float, _typing.Tuple[float, float]], y: _typing.Optional[float] = None):
        '''
        returns the angle between the line from turtle position to position specified by (x,y)
        '''
        if isinstance(x, _typing.Tuple) or isinstance(x, _typing.List) and len(x) == 2 and y == None:
            x, y = x
            angle = _dispatch_return_action(_TOWARDS, [x, -y], id=self.id)
            angle = (angle*self._fullCircle)/(_math.pi*2)
            return angle
        elif isinstance(x, (float, int)) and isinstance(y, (float, int)):
            angle = _dispatch_return_action(_TOWARDS, [x, -y], id=self.id)
            angle = (angle*self._fullCircle)/(_math.pi*2)
            return angle
        else:
            raise TypeError("invalid argument types")

    def xcor(self):
        '''
        return the global x-coordinate
        '''
        x = float(_dispatch_return_action(_XCOR, id=self.id))
        return float(x)

    def ycor(self):
        '''
        return the global y-coordinate
        '''
        y = float(-_dispatch_return_action(_YCOR, id=self.id))
        return float(y)

    def heading(self):
        '''
        return the current heading of the turtle
        the turtle's heading is zero at the start
        '''
        pixiheading = _dispatch_return_action(_HEADING, id=self.id)
        pixiheading = (pixiheading*self._fullCircle)/(_math.pi*2)
        return _round(-pixiheading % self._fullCircle)

    def distance(self,  x: _typing.Union[float, _typing.Tuple[float, float]], y: _typing.Optional[float] = None):
        '''
        returns the distance from turtle to (x,y)
        '''
        if isinstance(x, _typing.Tuple) and y == None:
            x, y = x
            return float(_dispatch_return_action(_DISTANCE, [x, -y], self.id))
        elif isinstance(x, (float, int)) and isinstance(y, (float, int)):
            return float(_dispatch_return_action(_DISTANCE, [x, -y], self.id))
        else:
            raise TypeError("invalid argument types")

    # Setting and measurement
    def degrees(self, fullcircle=360):
        '''
        Set angle measurement units, i.e. set number of “degrees” for a full circle. Default value is 360 degrees.
        '''
        self._fullCircle = fullcircle

    def radians(self):
        '''
        Set the angle measurement units to radians. Equivalent to degrees(2*_math.pi).
        '''
        self._fullCircle = 2*_math.pi
    # Drawing state

    def pendown(self):
        '''
        pull the pen down - drawing when moving
        '''
        _add_action(_PEN, True, self.id)
    pd = pendown
    down = pendown

    def penup(self):
        '''
        pull the pen up - no drawing when moving
        '''
        _add_action(_PEN, False, self.id)
    pu = penup
    up = penup

    def pensize(self, width: float):
        '''
        change the width of the pen
        '''
        _add_action(_PENSIZE, width, self.id)
    width = pensize

    def isdown(self):
        '''
        return a boolean which tells if the turtle is drawing
        '''
        return _dispatch_return_action(_ISDOWN, id=self.id)

    def color(self, *args):
        '''
        Set and get fill and pencolor.
        If called with 0 arguments: returns a tuple with pencolor and fillcolor.
        If called with 1 arguments: Sets fill and pencolor to specified color.
        If called with 2 arguments: Sets pencolor to first argument and second color to second argument. 
        '''
        if len(args) == 0:
            return (self.pencolor(), self.fillcolor())
        elif len(args) == 1:
            self.pencolor(args[0])
            self.fillcolor(args[0])
        elif len(args) == 2:
            self.pencolor(args[0])
            self.fillcolor(args[1])
        elif len(args) == 3:
            self.pencolor(*args)
            self.fillcolor(*args)
        else:
            raise ValueError("Invalid number of arguments")

    # Color control
    def pencolor(self, *args):
        '''
        Change color of the pen
        :param color: can either be the color as a string e.g 'black' or its hex code or "rgb(r, g, b)"
        '''
        if len(args) == 0:
            return self._pencolor
        else:
            color = make_color(*args)
            if len(args) == 1:
                args = args[0]
            self._pencolor = color
            _add_action(_PENCOLOR, _pixi_color(color), self.id)

    def fillcolor(self, *args):
        '''
        change the color when filling
        :param color: can either be the color as a string e.g 'black' or its hex code or "rgb(r, g, b)"
        '''
        if len(args) == 0:
            return self._fillcolor
        else:
            color = make_color(*args)
            if len(args) == 1:
                args = args[0]
            self._fillcolor = color
            _add_action(_FILLCOLOR, _pixi_color(color), self.id)

    # Filling
    def filling(self):
        '''
        check if begin_fill was called
        '''
        return _dispatch_return_action(_FILLING, id=self.id)

    def begin_fill(self):
        '''
        start recording all drawing-functions to be filled
        '''
        _add_action(_BEGINFILL, id=self.id)

    def end_fill(self):
        '''
        fill the shape drawn after the last call to begin_fill
        '''
        _add_action(_ENDFILL, id=self.id)

    # More drawing control
    def write(self, text: str, move=False, align='left', font=('arial', 8, 'normal')):
        '''
        writes text on the canvas at the turtle position.
        '''
        _add_action(_WRITE, [text, move, align, font], self.id)

    # Visibility
    def showturtle(self):
        '''
        Makes the turtle visible. Sets speed to 20.
        '''
        _add_action(_HIDETURTLE, 0, self.id)
    st = showturtle

    def hideturtle(self):
        '''
        Makes the turtle invisible. Sets speed to -1.
        '''
        _add_action(_HIDETURTLE, 1, self.id)
    ht = hideturtle

    def isvisible(self):
        '''
        return True if the turtle is shown, False if it’s hidden
        '''
        return _dispatch_return_action(_ISVISIBLE, id=self.id)

    # Appearance
    def shape(self, shape: str = None):
        """Set turtle shape to shape with given name / return current shapename.

        Optional argument:
        name -- a string, which is a valid shapename

        Set turtle shape to shape with given name or, if name is not given,
        return name of current shape.
        Shape with name must exist in the TurtleScreen's shape dictionary.
        Initially there are the following polygon shapes:
        'arrow', 'turtle', 'circle', 'square', 'triangle', 'classic'.
        To learn about how to deal with shapes see Screen-method register_shape.

        Example (for a Turtle instance named turtle):
        >>> turtle.shape()
        'arrow'
        >>> turtle.shape("turtle")
        >>> turtle.shape()
        'turtle'
        """
        if shape:
            if _dispatch_return_action(_ISSHAPE, shape, id=self.id) or shape == "circle":
                _add_action(_SHAPE, shape, self.id)
            else:
                raise NameError("invalid shape name")
        else:
            return _dispatch_return_action(_GETSHAPE, id=self.id)

    def resizemode(self, rmode: str = None):
        raise NotImplementedError()

    def shapesize(self, *args):
        raise NotImplementedError()
    turtlesize = shapesize

    def shearfactor(self, *args):
        raise NotImplementedError()

    def settiltangle(self, *args):
        raise NotImplementedError()

    def tiltangle(self, *args):
        raise NotImplementedError()

    def tilt(self, *args):
        raise NotImplementedError()

    def shapetransform(self, *args):
        raise NotImplementedError()

    def get_shapepoly(self):
        """Return the current shape polygon as tuple of coordinate pairs.

        No argument.

        Examples (for a Turtle instance named turtle):
        >>> turtle.shape("square")
        >>> turtle.shapetransform(4, -1, 0, 2)
        >>> turtle.get_shapepoly()
        ((50, -20), (30, 20), (-50, 20), (-30, -20))

        """
        return _dispatch_return_action(_GET_SHAPEPOLY, id=self.id)

    # Special Methods
    def begin_poly(self, *args):
        raise NotImplementedError()

    def end_poly(self, *args):
        raise NotImplementedError()

    def get_poly(self, *args):
        raise NotImplementedError()

    def clone(self, *args):
        raise NotImplementedError()

    def getturtle(self, *args):
        raise NotImplementedError()
    getpen = getturtle

    def getscreen(self, *args):
        raise NotImplementedError()

    def setundobuffer(self, *args):
        raise NotImplementedError()

    def undobufferentries(self, *args):
        raise NotImplementedError()

    # Events
    onclick = _Screen.onclick
    ondrag = _Screen.ondrag
    onmove = _Screen.onmove

    # Our Methods
    def get_pixel_color(self):
        '''
        return the color the turtle is standing on
        '''
        color = list(
            map(float, _dispatch_return_action(_GETPIXELCOLOR, id=self.id)))
        return make_color(*color)

    def get_pixel_color_str(self):
        '''
        return the color string of the color the turtle is standing on
        '''
        return self.get_pixel_color().colorstr
    
    # NCCB: Removed TigerPython's save_playground method


Pen = Turtle


def get_event_log(blocking: bool = True):
    eventLog = _return_action(_GETEVENTLOG, blocking)
    return eventLog.to_py()


def set_event_mode(state: bool):
    _return_action(_SETEVENTMODE, state)


def update_func(funcstr: str, fun, add=False):
    if fun:
        if add:
            func1 = _EVENT_FUNC_DICT[funcstr]
            func2 = fun

            def newfunc(*args):
                func1(*args)
                func2(*args)
            _EVENT_FUNC_DICT[funcstr] = newfunc
        else:
            _EVENT_FUNC_DICT[funcstr] = fun
    else:
        try:
            _EVENT_FUNC_DICT.pop(funcstr)
        except:
            pass


class Shape(object):
    """Data structure modeling shapes.

    attribute _type is one of "polygon", "image", "compound"
    attribute _data is - depending on _type a poygon-tuple,
    an image or a list constructed using the addcomponent method.
    """

    def __init__(self, type_, data=None):
        self._type = type_
        if type_ == "polygon":
            if isinstance(data, list):
                data = tuple(data)
        elif type_ == "image":
            if isinstance(data, str):
                if data.lower().endswith(".gif") and isfile(data):
                    data = _Screen._image(data)
                # else data assumed to be PhotoImage
        elif type_ == "compound":
            data = []
        else:
            raise TypeError("There is no shape type %s" % type_)
        self._data = data

    def addcomponent(self, poly, fill, outline=None):
        """Add component to a shape of type compound.

        Arguments: poly is a polygon, i. e. a tuple of number pairs.
        fill is the fillcolor of the component,
        outline is the outline color of the component.

        call (for a Shapeobject namend s):
        --   s.addcomponent(((0,0), (10,10), (-10,10)), "red", "blue")

        Example:
        >>> poly = ((0,0),(10,-5),(0,10),(-10,-5))
        >>> s = Shape("compound")
        >>> s.addcomponent(poly, "red", "blue")
        >>> # .. add more components and then use register_shape()
        """
        if self._type != "compound":
            raise TurtleGraphicsError("Cannot add component to %s Shape"
                                      % self._type)
        if outline is None:
            outline = fill
        self._data.append([poly, fill, outline])


# Adapted from turtle.py
_tg_classes = ['ScrolledCanvas', 'TurtleScreen', 'Screen',
               'RawTurtle', 'Turtle', 'RawPen', 'Pen', 'Shape', 'Vec2D']
_tg_turtle_functions = [method for method in dir(
    Turtle) if (method.startswith('_') or method in ["onclick", "ondrag", "onmove"]) is False]
_tg_screen_functions = [method for method in dir(
    _Screen) if method.startswith('_') is False]
_tg_utilities = ['write_docstringdict', 'done']

# __all__ = (_tg_classes + _tg_screen_functions + _tg_turtle_functions +
#            _tg_utilities + ['Terminator'])

_alias_list = ['addshape', 'backward', 'bk', 'fd', 'ht', 'lt', 'pd', 'pos',
               'pu', 'rt', 'seth', 'setpos', 'setposition', 'st',
               'turtlesize', 'up', 'width']

__func_body = """\
def {name}{paramslist}:
    if {obj} is None:
        {obj} = {init}
    return {obj}.{name}{argslist}
"""


def getmethparlist(ob):
    """
    Get strings describing the arguments for the given object
    Returns a pair of strings representing function parameter lists
    including parenthesis.  The first string is suitable for use in
    function definition and the second is suitable for use in function
    call.  The "self" parameter is not included.
    """
    orig_sig = _inspect.signature(ob)
    # bit of a hack for methods - turn it into a function
    # but we drop the "self" param.
    # Try and build one for Python defined functions
    
    # NCCB: modified this to drop annotations as we had issues with "_typing.Optional" turning
    # into "Optional" and then not being found.  We don't even need the annotations in the proxied version, anyway.
    func_sig = orig_sig.replace(
        parameters=[p.replace(annotation=_inspect._empty) for p in list(orig_sig.parameters.values())[1:]],
        return_annotation=_inspect._empty,
    )

    call_args = []
    for param in func_sig.parameters.values():
        match param.kind:
            case(
            _inspect.Parameter.POSITIONAL_ONLY
            | _inspect.Parameter.POSITIONAL_OR_KEYWORD
            ):
                call_args.append(param.name)
            case _inspect.Parameter.VAR_POSITIONAL:
                call_args.append(f'*{param.name}')
            case _inspect.Parameter.KEYWORD_ONLY:
                call_args.append(f'{param.name}={param.name}')
            case _inspect.Parameter.VAR_KEYWORD:
                call_args.append(f'**{param.name}')
            case _:
                raise RuntimeError('Unsupported parameter kind', param.kind)
    call_text = f'({", ".join(call_args)})'

    return str(func_sig), call_text


def _turtle_docrevise(docstr):
    """To reduce docstrings from RawTurtle class for functions
    """
    import re
    if docstr is None:
        return None
    turtlename = "turtle"
    newdocstr = docstr.replace("%s." % turtlename, "")
    parexp = re.compile(r' \(.+ %s\):' % turtlename)
    newdocstr = parexp.sub(":", newdocstr)
    return newdocstr


def _screen_docrevise(docstr):
    """To reduce docstrings from TurtleScreen class for functions
    """
    import re
    if docstr is None:
        return None
    screenname = "screen"
    newdocstr = docstr.replace("%s." % screenname, "")
    parexp = re.compile(r' \(.+ %s\):' % screenname)
    newdocstr = parexp.sub(":", newdocstr)
    return newdocstr


def _make_global_funcs(functions, cls, obj, init, docrevise):
    for methodname in functions:
        try:
            method = getattr(cls, methodname)
            pl1, pl2 = getmethparlist(method)
            if pl1 == "":
                print(">>>>>>", pl1, pl2)
                continue
            defstr = __func_body.format(obj=obj, init=init, name=methodname,
                                        paramslist=pl1, argslist=pl2)
            globals_dict = globals()
            exec(defstr, globals())
            globals()[methodname].__doc__ = docrevise(method.__doc__)
        except:
            pass


_make_global_funcs(_tg_screen_functions, _Screen,
                   'Turtle._screen', 'Screen()', _screen_docrevise)
_make_global_funcs(_tg_turtle_functions, Turtle,
                   'Turtle._pen', 'Turtle()', _turtle_docrevise)
done = mainloop
