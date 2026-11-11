<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => ['status' => 'ok']);
Route::middleware('auth:sanctum')->get('/orders', [\App\Http\Controllers\OrderController::class, 'index']);
