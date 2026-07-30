# Dext Lab — immagine PHP+Apache (tiene le .htaccess del progetto)
FROM php:8.2-apache

# Estensioni: pdo_pgsql (libpq-dev), mbstring (libonig-dev)
RUN apt-get update \
 && apt-get install -y --no-install-recommends libonig-dev libpq-dev \
 && docker-php-ext-install pdo_pgsql mbstring \
 && a2enmod rewrite headers expires deflate \
 && rm -rf /var/lib/apt/lists/*

# Abilita le .htaccess (AllowOverride All sulla docroot)
RUN sed -ri 's/AllowOverride None/AllowOverride All/g' /etc/apache2/apache2.conf

# Codice del sito (build context = cartella padre del progetto)
COPY . /var/www/html/
# escludi la cartella docker dalla docroot pubblica
RUN rm -rf /var/www/html/deploy-docker \
 && chown -R www-data:www-data /var/www/html

EXPOSE 80
