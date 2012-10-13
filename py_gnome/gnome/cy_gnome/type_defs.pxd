# Declare C++ structures defined in lib_gnome header files
# that maybe used by cython
cdef extern from "Basics.h":
    ctypedef struct DateTimeRec:
        short year
        short month
        short day
        short hour
        short minute
        short second
        short dayOfWeek
    
    ctypedef char **CHARH
    ctypedef CHARH Handle

cdef extern from "TypeDefs.h":
    ctypedef unsigned long LETYPE    
    ctypedef unsigned long Seconds
    ctypedef unsigned char    Boolean
    ctypedef short    OSErr
    ctypedef unsigned long LETYPE

cdef extern from "GEOMETRY.H":
    ctypedef struct WorldPoint:
        double pLong
        double pLat
    ctypedef struct WorldPoint3D:
        WorldPoint p
        double z
    ctypedef struct WorldRect:
        long loLong
        long loLat
        long hiLong
        long hiLat
        
cdef extern from "TypeDefs.h":
    ctypedef struct TModelDialogVariables:
        Boolean bUncertain
        Boolean preventLandJumping
        
    ctypedef struct TR_OPTIMZE:
        Boolean isOptimizedForStep
        Boolean isFirstStep
        double value
        double uncertaintyValue

    ctypedef struct LERec:
        long leUnits
        long leKey
        long leCustomData
        WorldPoint p
        double z
        unsigned long releaseTime
        double ageInHrsWhenReleased
        unsigned long clockRef
        short pollutantType
        double mass
        double density
        double windage
        long dropletSize
        short dispersionStatus
        double riseVelocity
        short statusCode
        WorldPoint lastWaterPt
        unsigned long beachTime
        
    ctypedef struct VelocityRec:
        double u
        double v
        
    ctypedef struct VelocityFRec:
        float u
        float v
        
    ctypedef VelocityFRec **VelocityFH
    
    ctypedef struct LoadedData:
        long timeIndex
        VelocityFH dataHdl

    ctypedef struct LEWindUncertainRec:
        float randCos
        float randSin

    ctypedef struct TimeValuePair:
        Seconds time
        VelocityRec value

    ctypedef TimeValuePair **TimeValuePairH
    ctypedef TimeValuePair *TimeValuePairP 

    # would be good to figure out how to call enum by type??
    ctypedef enum LEStatus: 
        OILSTAT_NOTRELEASED = 0
        OILSTAT_INWATER = 2
        OILSTAT_ONLAND
        OILSTAT_OFFMAPS = 7
        OILSTAT_EVAPORATED = 10 
    
    ctypedef enum LEType:
        FORECAST_LE = 1
        UNCERTAINTY_LE = 2
    
    ctypedef enum:
        DONT_DISPERSE 
        DISPERSE
        HAVE_DISPERSED
        DISPERSE_NAT
        HAVE_DISPERSED_NAT
        EVAPORATE
        HAVE_EVAPORATED
        REMOVE
        HAVE_REMOVED
        
    ctypedef enum:
        M19REALREAL = 1
        M19HILITEDEFAULT    
        M19MAGNITUDEDEGREES
        M19DEGREESMAGNITUDE
        M19MAGNITUDEDIRECTION
        M19DIRECTIONMAGNITUDE