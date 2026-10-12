"""Closed equal-pitch hip roof, including deep and square footprints (cm)."""
import math

def walmdach(breite, tiefe, ueberstand, traufe, neigung):
    if min(breite, tiefe) <= 0 or ueberstand < 0 or not 0 < neigung < 90:
        raise ValueError('Ungueltige Walmdachmasse oder Dachneigung')
    x0, x1, y0, y1 = -ueberstand, breite + ueberstand, -ueberstand, tiefe + ueberstand
    h = min(breite, tiefe) / 2 + ueberstand
    z = traufe + math.tan(math.radians(neigung)) * h
    v = [[x0,y0,traufe],[x1,y0,traufe],[x1,y1,traufe],[x0,y1,traufe]]
    if abs(breite-tiefe) < 1e-6:
        v += [[breite/2,tiefe/2,z]]
        f = [[0,3,2,1],[0,1,4],[1,2,4],[2,3,4],[3,0,4]]
    elif breite > tiefe:
        v += [[x0+h,tiefe/2,z],[x1-h,tiefe/2,z]]
        f = [[0,3,2,1],[0,1,5,4],[1,2,5],[2,3,4,5],[3,0,4]]
    else:
        v += [[breite/2,y0+h,z],[breite/2,y1-h,z]]
        f = [[0,3,2,1],[0,1,4],[1,2,5,4],[2,3,5],[3,0,4,5]]
    return {'verts':v,'faces':f}, z
