<?php

namespace App\Models;

use CodeIgniter\Model;

class TourModel extends Model
{
    protected $table = 'tours';
    protected $primaryKey = 'activityId';
    protected $allowedFields = ['activityName', 'activityDate', 
    'activityType', 'activityDescription', 'activityDescription', 
    'maxParticipant', 'joinedParticipant', 'presentNo', 'absentNo', 'isActive'];

    protected $dateFormat = "date";
}