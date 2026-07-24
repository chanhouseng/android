<?php

namespace App\Controllers;

use App\Models\ParticipantModel;
use CodeIgniter\Controller;

class ParticipantController extends Controller
{
    protected $model;

    public function __construct()
    {
        $this->model = new ParticipantModel();
    }

    // Display all tours
    public function index()
    {
        $data['participants'] = $this->model->findAll();
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }

    // Display a tour
    public function get($activityId) 
    {
        $data['participants'] = $this->model->where('activityId', 5)->findAll();
        return $this->response->setContentType('application/json')->setBody(json_encode($data, JSON_UNESCAPED_UNICODE));
    }    
}