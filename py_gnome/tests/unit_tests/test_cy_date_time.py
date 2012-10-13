#!/usr/bin/evn python
"""
test time conversions from date time to seconds and vice versa
just a python script right now
"""

from gnome.cy_gnome import cy_date_time
import datetime
import time
import numpy as np
from gnome import basic_types
from gnome.utilities import time_utils

class TestCy_date_time():
    target = cy_date_time.Cy_date_time()
    now =  datetime.datetime.now()

    daterec = np.empty((1,), dtype=basic_types.date_rec)
    daterec['year'] = now.year
    daterec['month'] = now.month
    daterec['day'] = now.day
    daterec['hour'] = now.hour
    daterec['minute'] = now.minute
    daterec['second'] = now.second
    daterec['dayOfWeek'] = now.weekday() # Gnome 
 
    # use this time for testing
    pySec = time_utils.dateToSeconds_noDst(now)

    def SecondsToDateFromPyGnome(self, seconds):
        '''
        py_gnome uses this to convert time back to date
        '''
        pyDate = time_utils.secondsToDate_noDst(self.pySec)
        date = np.empty((1,), dtype=basic_types.date_rec)
        date['year'] = pyDate.tm_year
        date['month'] = pyDate.tm_mon
        date['day'] = pyDate.tm_mday
        date['hour'] = pyDate.tm_hour
        date['minute'] = pyDate.tm_min
        date['second'] = pyDate.tm_sec
        date['dayOfWeek'] = pyDate.tm_wday
        return date

    def test_DateToSeconds(self):
        '''
        Test DateToSeconds Gnome function. 
        Note the tm_dst = 0 before comparing against Python results
        '''
        sec = self.target.DateToSeconds(self.daterec)
        print "pySec - sec: " + str(self.pySec - sec)
        assert self.pySec == sec

    def test_SecondsToDate(self):
        '''
        Test Gnome's reverse conversion back to Date
        '''
        date = np.empty((1,), dtype=basic_types.date_rec)
        date = self.target.SecondsToDate(self.pySec)

        # let's also get the date from pyGnome function
        pyDate = self.SecondsToDateFromPyGnome(self.pySec)

        # check assertions for everything except dayOfWeek - this doesn't match
        # however, I don't believe this is used anywhere
        # NOTE (JS): Not sure 1 is added to day of the week in StringFunctions.CPP
        # This doesn't seem to effect the date/time value - left it as is.
        # The C++ time struct 0=Sunday and 6=Sat. For Python time struct 0=Monday and 6=Sunday
        for field in list(date):
           
            # for pyDate all fields must match
            assert pyDate[field] == self.daterec[field][0]

            if field != 'dayOfWeek':
                print field + ":" + str(date[field]) + " " + str(self.daterec[field][0])
                assert date[field] == self.daterec[field][0]

if __name__=="__main__":
    a = TestCyDateTime()
    a.test_DateToSeconds()
    a.test_SecondsToDate()