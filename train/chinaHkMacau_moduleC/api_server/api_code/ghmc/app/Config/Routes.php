<?php

use CodeIgniter\Router\RouteCollection;

/**
 * @var RouteCollection $routes
 */
$routes->get('/', 'Home::index');
//Event CRUD
$routes->get('tour', 'TourController::index');
$routes->get('tour/(:segment)', 'TourController::get/$1');

$routes->post('tour', 'TourController::store');
$routes->put('tour/(:segment)', 'TourController::update/$1');

$routes->delete('tour/(:segment)', 'TourController::delete/$1');


$routes->get('participant', 'ParticipantController::index');
$routes->get('participant/(:segment)', 'ParticipantController::get/$1');

$routes->post('login', 'LoginController::index');