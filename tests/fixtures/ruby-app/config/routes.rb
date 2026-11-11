Rails.application.routes.draw do
  get "up" => "rails/health#show"
  resources :orders, only: [:index, :create]
end
