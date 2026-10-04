location = /deep-surge-lab { return 308 /deep-surge-lab/; }
location ^~ /deep-surge-lab/ {
    proxy_pass http://127.0.0.1:3184;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location = /deep-surge-editor { return 308 /deep-surge-editor/; }
location ^~ /deep-surge-editor/ {
    proxy_pass http://127.0.0.1:3184;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
